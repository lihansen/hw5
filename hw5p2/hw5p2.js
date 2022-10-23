const fs = require('fs');
const http = require('http');
const { reject, pad, result, find, merge } = require('lodash');
const { number, ParenthesisNodeDependencies } = require('mathjs');
const { ObjectId } = require('mongodb');
const { resolve } = require('path');
const url = require('url');
const express = require('express')
const app = express()
const server_port = 3000


////////////////////////////////////////////////////////////////////////////////////
///////////////////////////// player //////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////




// 1
app.get('/ping', (req, res) => {
    res.writeHead(204);
    res.end();
})

// 2
app.get('/player', (req, res) => {
    MongoClient.connect(mongo_url, function (err, db) {
        if (err) process.exit(5);

        var dbo = db.db(config_json.db);
        dbo.collection(config_json.collection).find({}).toArray(function (err, result) {
            var data = [];
            for (var obj of result) {
                data.push(convert_db_to_json_player(obj));
            }
            // sorting the data
            data.sort(function (p1, p2) {
                if (p1.name < p2.name) return -1;
                if (p1.name > p2.name) return 1;
            })
            res.writeHead(200);
            res.write(JSON.stringify(data));
            res.end();
            db.close();
        })
    })
})


// 3
app.get('/player/:pid', (req, res) => {
    var pid = req.params.pid;
    p_find(pid, mongo_url).then(
        (data) => {
            var rdata = convert_db_to_json_player(data);
            res.writeHead(200);
            res.write(JSON.stringify(rdata));
            res.end();
        },

        (err) => {
            res.writeHead(404);
            res.end();
        });
})

// 4
app.delete('/player/:pid', (req, res) => {
    var pid = req.params.pid;
    MongoClient.connect(mongo_url, function (err, db) {
        var dbo = db.db(config_json.db);
        var ido = new ObjectId(pid);
        var coll = config_json.collection;

        dbo.collection(coll).deleteOne({ _id: ido }, function (err, result) {
            if (result.deletedCount == 1) {
                res.writeHead(303, { 'Location': '/player' });
                res.end();
            } else {
                res.writeHead(404);
                res.end()
            }
            db.close();
        })
    })
})




// 5

// {
//     fname: 'fplicjwx',
//     lname: 'sqomcqkb',
//     handed: 'left',
//     initial_balance_usd_cents: '566'
//   }

app.post('/player', (req, res) => {
    var query = req.query;

    var checked = check_invalid_query(query);
    const db = req.app.locals.db;
    var invalids = checked;
    fill_empty_fields(query);

    if (invalids.length == 0) {
        // valid query  
        var date = new Date();
        var document = {
            fname: query.fname,
            lname: query.lname,
            handed: handed_query_to_db[query.handed],
            is_active: query.active,

            num_join: undef_to_num(query.num_join),
            num_won: undef_to_num(query.num_won),
            num_dq: undef_to_num(query.num_dq),
            total_points: undef_to_num(query.total_points),
            total_prize_usd_cents: undef_to_num(query.total_prize_usd_cents),
            efficiency: undef_to_num(query.efficiency),
            in_active_match: undef_to_str(query.in_active_match),
            balance_usd_cents: number(query.initial_balance_usd_cents),
            created_at: date,
        }

        p_insert(document, db).then(
            (data) => {
                var new_id = data.insertedId.toString();
                res.writeHead(303, { 'Location': '/player/' + new_id.toString() });
                res.end();
            },
            (err) => {
                print(err)
            }
        )
    } else {
        res.writeHead(422);
        res.write('invalid fields: ' + invalids.join())
        res.end();

    }

})




// 6
app.post('/player/:pid', (req, res) => {
    var pid = req.params.pid;
    var query = req.query;

    if (!query) {
        res.writeHead(303, { 'Location': '/player/' + pid });
        res.end();
    } else {

        p_find(pid, mongo_url).then(
            (data) => {
                // var oid = new ObjectId(pid);
                // throw new Error(oid.toString() + "->" + pid);
                var update_query = {};

                if ('fname' in query) {
                    update_query['fname'] = query['fname'];
                }
                if ('lname' in query) {
                    update_query['lname'] = query['lname'];
                }
                if ('handed' in query) {
                    update_query['handed'] = handed_query_to_db[query['handed']];
                }
                if ('active' in query) {
                    if (query['active'] == 'f' || query['isactive'] == false) {
                        update_query['is_active'] = false
                    }
                    if (query['active'] in { 't': 1, '1': 1, 'true': 1, 'T': 1, 'TRUE': 1 }
                        || query['active'] == true) {
                        update_query['is_active'] = true
                    }
                }

                p_update(pid, mongo_url, update_query).then((data) => {

                    res.writeHead(303, { 'Location': '/player/' + pid });
                    res.end();
                }, (err) => {
                    // res.writeHead(404);
                    // res.end();
                    res.writeHead(303, { 'Location': '/player/' + pid });
                    res.end();
                });
            },
            (err) => {
                res.writeHead(404);
                res.end();
            }
        )
    }
})





// 7
app.post('/deposit/player/:pid', (req, res) => {
    var pid = req.params.pid;
    var query = req.query;


    //check query 

    if (!/^[0-9]*$/.test(query.amount_usd_cents)) {
        res.writeHead(400);
        res.end();
    } else {
        var increase = number(query.amount_usd_cents);

        p_find(pid, mongo_url).then(
            (data) => { // player found 

                var old_blc = data.balance_usd_cents;
                var new_blc = old_blc + increase;
                p_update(pid, mongo_url, { balance_usd_cents: new_blc }).then(
                    (data) => {
                        res.writeHead(200);
                        res.write(JSON.stringify({
                            old_balance_usd_cents: old_blc,
                            new_balance_usd_cents: new_blc,
                        }))
                        res.end();
                    }, (err) => {
                        res.writeHead(404);
                        res.end();
                    })

            }, (err) => {
                // player not found 
                res.writeHead(404);
                res.end();
            })


    }


})

////////////////////////////////////////////////////////////////////////////////////
///////////////////////////// match //////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////




function convert_db_to_json_match(mch_result) {
    return {
        mid: mch_result._id,
        entry_fee_usd_cents: mch_result.entry_fee_usd_cents,
        p1_id: undef_to_str(mch_result.p1_id),
        p2_id: undef_to_str(mch_result.p2_id),
        p1_name: undef_to_str(mch_result.p1_name),
        p2_name: undef_to_str(mch_result.p2_name),
        p1_points: undef_to_num(mch_result.p1_points),
        p2_points: undef_to_num(mch_result.p2_points),
        winner_pid: undef_to_str(mch_result.winner_pid),
        is_dq: decorate_bool(mch_result.is_dq),
        is_active: decorate_bool(mch_result.is_active),
        prize_usd_cents: (mch_result.prize_usd_cents),
        // age: Math.abs(Date() - mch_result.created_at) / 1000,
        age:2,
        ended_at: undef_to_str(mch_result.ended_at)

    }

}
function decorate_bool(a) {
    if (typeof (a) == 'undefined') return true;
    return a
}




// 1
app.get('/match', (req, res) => {
    // return matches sorted by prize_usd_cents DESC
    const db = req.app.locals.db;

    db.collection('match')
        .find({}).toArray(function (err, m_objs) {
            if (err) {
                throw new Error(err.stack);
            }

            var act_mchs = []
            var inact_mchs = []
            // print(m_objs)
            for (var m of m_objs) {
                if (m.ended_at != null) {
                    act_mchs.push(convert_db_to_json_match(m));
                } else {
                    inact_mchs.push(convert_db_to_json_match(m));
                }
            }

            // sort by active prize, decrease order
            act_mchs.sort(function (m1, m2) {
                if (m1.prize_usd_cents > m2.prize_usd_cents) return -1;
                return 1;
            });

            // inact sort by end_at, decrease order 
            inact_mchs.sort(function (m1, m2) {
                if (m1.ended_at > m2.ended_at) return -1;
                return 1;
            });

            if (inact_mchs.length > 4) {
                inact_mchs = inact_mchs.slice(0,4)
            }
            
            var r_data = act_mchs.concat(inact_mchs);
            // if (r_data.length > 4) {
            //     r_data = r_data.slice(0,4)
            // }
            res.writeHead(200);
            res.write(JSON.stringify(r_data));
            res.end();

        });
})




// 2
app.get('/match/:mid', (req, res) => {
    var query = req.query;
    var mid = req.params.mid;
    const db = req.app.locals.db;
    // print(mid)
    if (req.params.mid.length != 24) {
        res.writeHead(404);
        res.end()
    } else {
        db.collection('match').findOne({ '_id': ObjectId(mid) }, function (err, m_result) {
            if (err) {
                throw new Error(err.stack);
            }
            // print(m_result)
            if (m_result) {
                var m_data = convert_db_to_json_match(m_result);
                // print(m_data)
                res.writeHead(200);
                res.write(JSON.stringify(m_data));
                res.end();

            } else {
                // match not exists
                res.writeHead(404);
                res.end();
            }
        })
    }



})





//3
// start a new match 
app.post('/match', (req, res) => {
    var query = req.query;
    const db = req.app.locals.db;
    if (!check_dig_str(query.entry_fee_usd_cents) &&
        !check_dig_str(query.entry_fee_usd_cents)) {
        res.writeHead(400);
        res.end();
    } else {
        var entry_fee = undef_to_num(query.entry_fee_usd_cents);
        var prize = undef_to_num(query.prize_usd_cents);
        let pid1 = query.p1_id;
        let pid2 = query.p2_id;

        Promise.all([
            find_one(db, 'player', { _id: ObjectId(pid1) }),
            find_one(db, 'player', { _id: ObjectId(pid2) })
        ])
            .then(
                (result) => {
                    let p1_result = result[0];
                    let p2_result = result[1];

                    if (!p1_result || !p2_result) {
                        return 404;
                    }

                    if (p1_result.in_active_match || p2_result.in_active_match) {
                        return 409;
                    }
                    if (p1_result.balance_usd_cents < entry_fee ||
                        p2_result.balance_usd_cents < entry_fee) {
                        return 402;
                    }

                    var date_now = new Date();
                    var insert_query = {
                        created_at: date_now,
                        ended_at: null,
                        entry_fee_usd_cents: entry_fee,
                        is_dq: false,
                        p1_id: ObjectId(pid1),
                        p1_points: undef_to_num(p1_result.total_points),
                        p1_name: p1_result.fname + " " + p1_result.lname,
                        p2_name: p2_result.fname + " " + p2_result.lname,
                        p2_id: ObjectId(pid2),
                        p2_points: undef_to_num(p2_result.total_points),
                        prize_usd_cents: prize
                    };

                    return Promise.all([
                        insert_one(db, 'match', insert_query),
                        update_one(db, 'player', { _id: ObjectId(pid1) },
                            {
                                $inc: { balance_usd_cents: -1 * entry_fee },
                                $set: { in_active_match: true }
                            }),
                        update_one(db, 'player', { _id: ObjectId(pid2) },
                            {
                                $inc: { balance_usd_cents: -1 * entry_fee },
                                $set: { in_active_match: true }
                            })
                    ])
                }
            ).then(result => {
                if (typeof (result) == "number") {
                    res.writeHead(result);
                } else {
                    // print(result.length)
                    if (result && result.length == 3 && result[0] && result[1] && result[2]) {
                        let inser_id = result[0].insertedId.toString()
                        res.writeHead(303, { 'Location': '/match/' + inser_id });
                    } else {
                        res.writeHead(400);
                    }
                }
                res.end();

            })
    }
});



//4
app.post('/match/:mid/award/:pid', (req, res) => {
    var query = req.query;
    const db = req.app.locals.db;

    if (!check_dig_str(query.points) || undef_to_num(query.points) <= 0) {
        res.writeHead(400);
        res.end();
    } else if (req.params.pid.length != 24 ||
        req.params.mid.length != 24) {
        res.writeHead(404);
        res.end()
    } else {
        var points = undef_to_num(query.points);
        var winner_id = req.params.pid;
        var mid = req.params.mid;

        Promise.all([
            find_one(db, 'player', { _id: ObjectId(winner_id) }),
            find_one(db, 'match', { _id: ObjectId(mid) })
        ]).then(
            (result) => {
                let p_result = result[0];
                let m_result = result[1];

                if (!result[0] || !result[1]) {
                    return 404;
                }
                // match not active
                if (m_result.ended_at != null) {
                    return 409;
                }

                let update_query;
                // plyer in match
                if (winner_id == m_result.p1_id) {
                    update_query = { "p1_points": points };
                } else if (winner_id == m_result.p2_id) {
                    update_query = { "p2_points": points };
                } else {
                    // p is not in m
                    return 400
                }
                return Promise.all([
                    update_one(db, 'match', { _id: ObjectId(mid) }, {
                        $inc: update_query,
                        $set: {
                            p1_name: p_result.fname + " " + p_result.lname,
                        }
                    }),
                    update_one(db, 'player', { _id: ObjectId(winner_id) }, { $inc: { total_points: points } })
                ])
            }
        ).then((result) => {

            if (typeof (result) == 'number') {
                return result;
            } else {
                if (result[0] && result[1]) {
                    return find_one(db, 'match', { _id: ObjectId(mid) });
                } else {
                    return 400;
                }
            }
        }).then((result) => {
            if (typeof (result) == 'number') {
                res.writeHead(result);
            } else if (result) {
                var m_data = convert_db_to_json_match(result);
                res.writeHead(200);
                res.write(JSON.stringify(m_data))
            }
            res.end();
        })


    }


})
// 5
app.post('/match/:mid/end', (req, res) => {
    // find the match 
    let query = req.query;
    let mid = req.params.mid;
    const db = req.app.locals.db;

    if (req.params.mid.length != 24) {
        res.writeHead(404);
        res.end()
    } else {
        find_one(db, 'match', { _id: ObjectId(mid) }
        ).then(
            (result) => {
                if (!result) {
                    return 404;
                } else if (result.ended_at != null ||
                    result.p1_points == result.p2_points) {
                    return 409;
                } else {
                    // find the winner 
                    var winner_id;
                    if (result.p1_points > result.p2_points) {
                        winner_id = result.p1_id;
                    } else {
                        winner_id = result.p2_id;
                    }
                    var now = new Date()
                    return Promise.all([
                        update_one(db, 'match', { _id: ObjectId(mid) }, {
                            $set:
                                { ended_at: now.toISOString() }
                        }),
                        update_one(db, 'player', { _id: ObjectId(winner_id) }, {
                            $inc: { balance_usd_cents: result.prize_usd_cents }
                        }),
                        find_one(db, 'match', { _id: ObjectId(mid) })
                    ]);
                }
            }
        ).then(
            (result) => {
                if (typeof (result) == 'number') {
                    res.writeHead(result);
                } else {
                    if (result[0] && result[1]) {
                        res.writeHead(200);
                        var m_data = convert_db_to_json_match(result[2]);
                        res.write(JSON.stringify(m_data));
                    }
                }
                res.end();
            }
        )
    }

})



//6 
app.post('/match/:mid/disqualify/:pid', (req, res) => {
    let mid = req.params.mid;
    let pid = req.params.pid;
    const db = req.app.locals.db;

    if (req.params.mid.length != 24 ||
        pid.length != 24) {
        res.writeHead(404);
        res.end()
    } else {

        Promise.all([
            find_one(db, 'player', { _id: ObjectId(pid) }),
            find_one(db, 'match', { _id: ObjectId(mid) })
        ]).then(
            (result) => {
                let p_result = result[0];
                let m_result = result[1];

                if (!result[0] || !result[1]) {
                    return 404;
                }
                // match not active
                if (m_result.ended_at != null) {
                    return 409;
                }
                // plyer not  in match
                var win_pid;
                if (pid == m_result.p1_id) {
                    win_pid = m_result.p2_id;
                } else if (pid == m_result.p2_id) {
                    win_pid = m_result.p1_id;
                } else {
                    return 400;
                }
                var now = new Date()
                return Promise.all([
                    update_one(db, 'match', { _id: ObjectId(mid) }, {
                        $set: {
                            ended_at: now.toISOString(),
                            is_dq: true
                        }
                    }),

                    update_one(db, 'player', { _id: ObjectId(win_pid) }, {
                        $inc: {
                            balance_usd_cents: m_result.prize_usd_cents
                        }
                    }),
                    find_one(db, 'match', { _id: ObjectId(mid) })
                    // update_one(db, 'player', { _id: ObjectId(pid) }, { $set: {} }),
                ])
            }
        ).then(
            (result) => {
                if (typeof (result) == 'number') {
                    res.writeHead(result);
                } else {
                    if (result[0] && result[1]) {
                        res.writeHead(200);
                        var m_data = convert_db_to_json_match(result[2]);
                        res.write(JSON.stringify(m_data));
                    }
                }
                res.end();
            }
        )
    }
})

////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////db connection//////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////


let default_json = {
    host: "localhost",
    port: "27017",
    db: "ee547_hw",
    opts: {
        useUnifiedTopology: true
    }
}

let config_file_path = './config/mongo.json';
let config_json = default_json;


if (!fs.existsSync(config_file_path)) {
    // config file not exist
    config_json = default_json
}
else {

    let rawdata = fs.readFileSync(config_file_path);

    // invalid json
    try {
        config_json = JSON.parse(rawdata);
    }
    catch (e) {
        process.exit(2);
        // return 2;
    }

    // check empty fields -> use default values
    for (var key of Object.keys(config_json)) {
        if (config_json[key].length == 0) {
            config_json = default_json;
            break;
        }
    }
}

if (!("collection" in config_json)) {
    config_json['collection'] = 'player';
}


const mongo_url = 'mongodb://' + config_json.host + ':' + config_json.port;
var MongoClient = require('mongodb').MongoClient;

// const mg_client = MongoClient.connect(mongo_url);

MongoClient.connect(mongo_url, (err, db) => {
    if (err) {
        //   logger.warn(`Failed to connect to the database. ${err.stack}`);
        // throw new Error(err.stack);
    }

    var dbo = db.db(config_json.db);
    app.locals.db = dbo;


    app.listen(server_port, () => {
        // console.log(`Node.js app is listening at http://localhost:${server_port}`);
    });
});




////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////util functions//////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////





var handed_query_to_db = {
    left: "L",
    right: "R",
    ambi: "A",
}

var handed_db_to_json = {
    L: 'left',
    R: "right",
    A: "ambi",
}

var query_fields = ['fname', "lname", 'handed', 'initial_balance_usd', 'active'];


function convert_db_to_json_player(result) {
    var name = result.fname;
    if (result.lname) {
        name = name + ' ' + result.lname;
    }

    if (result.is_active == 'f') {
        result['is_active'] = false
    }
    return {
        pid: result._id,
        name: name,
        handed: handed_db_to_json[result.handed],
        num_join: undef_to_num(result.num_join),
        num_won: undef_to_num(result.num_won),
        num_dq: undef_to_num(result.num_dq),
        total_points: undef_to_num(result.total_points),
        total_prize_usd_cents: undef_to_num(result.total_prize_usd_cents),
        efficiency: undef_to_num(result.efficiency),
        balance_usd_cents: number(result.balance_usd_cents),
        is_active: result.is_active,
        in_active_match: undef_to_str(result.in_active_match)
    }
}

function undef_to_str(str) {
    if (!str) {
        return null;
    } else {
        return String(str)
    }
}

function undef_to_num(num) {
    if (!num) {
        return 0;
    } else {
        return number(num)
    }
}

function check_invalid_query(query) {
    let invalids = [];
    if ('fname' in query) {
        if (!/^[a-zA-Z()]+$/.test(query['fname'])) {
            invalids.push('fname')
        }
    } else { invalids.push('fname') }
    if ('lname' in query) {
        if (!/^[a-zA-Z()]+$/.test(query['lname'])) {
            invalids.push('lname')
        }
    } else { invalids.push('lname') }

    if ('handed' in query) {
        var lhand = query['handed']//.toLowerCase();
        if (!(lhand in { 'left': '', 'right': '', 'ambi': '' })) {
            invalids.push('handed');
        }
    }


    if ('initial_balance_usd_cents' in query) {
        var blc = query['balance_usd'];
        if (!/^[0-9]*$/.test(query.initial_balance_usd_cents)) {
            invalids.push('initial_balance_usd_cents');
        }

    }
    if ('active' in query) {
        if (query['active'] == true || query['active'] == false) {

        } else {
            invalids.push('active');
        }
    } else { query['active'] = true; }
    return invalids
}

function fill_empty_fields(query) {

    for (var field of query_fields) {
        if (!field in query) {
            query[field] = '';
        }
    }
}




function p_update(pid, mongo_url, update_query) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(mongo_url, function (err, db) {
            if (err) process.exit(5);
            var dbo = db.db(config_json.db);
            var ido = new ObjectId(pid);
            dbo.collection(config_json.collection).updateOne({ _id: ido },
                { $set: update_query },
                function (err, result) {

                    if (result && result.matchedCount == 1) {
                        resolve(result);
                    } else {
                        reject();
                    }
                    db.close();
                })

        })
    })
}


function p_find(pid, mongo_url) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(mongo_url, function (err, db) {
            if (!err) {
                var dbo = db.db(config_json.db);
                var ido = new ObjectId(pid);
                dbo.collection(config_json.collection).find({ _id: ido }).toArray(
                    function (err, result) {
                        if (err) {
                            console.log('p_finderror:')
                            console.log(err)
                            throw new Error(err.toString);
                            // throw new Error(err);
                        }

                        if (result.length > 0) {
                            resolve(result[0]);
                        } else {
                            reject(err);
                        }
                        db.close();
                    })
            }

        })
    })

}



function p_insert(insert_query, db) {
    return new Promise((resolve, reject) => {

        var dbo = db;
        dbo.collection(config_json.collection).insertOne(insert_query, function (err, result) {
            if (err) {
                print('p_insert error:')
                print(err)
                throw new Error(err);
            }

            if (result) {
                resolve(result);
            } else {
                reject(new Error('insert reject'));
            }
            // db.close()
        });

    })
}
function print(a) {
    console.log(a);
}

function check_dig_str(str) {
    return /^[0-9]*$/.test(str);
}

exports.x = check_invalid_query



function update_one(dbo, db_name, id_query, update_query) {
    return new Promise((resolve, reject) => {
        dbo.collection(db_name).updateOne(
            id_query,
            update_query,
            function (err, result) {
                if (err) throw new Error(err.stack);

                resolve(result);
            }
        );
    })
}

function insert_one(dbo, db_name, insert_query) {
    return new Promise((resolve, reject) => {
        dbo.collection(db_name).insertOne(
            insert_query,
            function (err, result) {
                if (err) throw new Error(err.stack);

                resolve(result);
            }
        );
    })
}

function find_one(dbo, db_name, id_query) {
    return new Promise((resolve, reject) => {
        dbo.collection(db_name).findOne(
            id_query,
            function (err, result) {
                if (err) throw new Error(err.stack);

                resolve(result);
            }
        );
    })
}