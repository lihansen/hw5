const fs = require('fs');
const http = require('http');
const { reject, pad } = require('lodash');
const { number, ParenthesisNodeDependencies } = require('mathjs');
const { ObjectId } = require('mongodb');
const { resolve } = require('path');
const url = require('url');
const express = require('express')
const app = express()
const server_port = 3000


// mid string match id
// entry_fee_usd_cents int currency
// p1_id string player 1 id
// p1_name string (see Player.name)
// p1_points int
// p2_id string player 2 id
// p2_name string (see Player.name)
// p2_points int
// winner_pid string|null null if active
// is_dq boolean true if end in dq
// is_active boolean
// prize_usd_cents int currency
// age int seconds since create
// ended_at string ISO-8601 (date+time)
// }
function convert_db_to_json_match(mch_db_obj) {
    return {
        // mid: m_data_id,
        // entry_fee_usd_cents: m_data.entry_fee_usd_cents,
        // p1_id: m_data.p1_id,
        // p2_id: m_data.p2_id,
        // p1_name: m_data.p1_name,
        // p2_name: m_data.p2_name,
        // winner_pid: 
        // is_dq: 
        // is_active:
        // prize_usd_cents
        // age: 
        // ended_at: 

    }

}

// 1
app.get('/match', (req, res) => {
    // return matches sorted by prize_usd_cents DESC
    const db = req.app.locals.db;

    db.collection(config_json.collection)
        .find({}).toArray(function (err, m_objs) {
            if (err) {
                throw new Error(err.stack);
            }


            var act_mchs = []
            var inact_mchs = []

            for (var m of m_objs) {
                if (m.is_active) {
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
                inact_mchs.slice
            }


            // useless
            res.writeHead(200);
            res.write(JSON.stringify(res_mches));
            res.end();

        });
})


// 2
app.get('/match/:mid', (req, res) => {
    var query = req.query;
    var mid = req.params.mid;
    const db = req.app.locals.db;
    var mido = new ObjectId(query.mid);
    db.collection('mactch').findOne({ '_id': mido }, function (err, m_result) {
        if (err) {
            throw new Error(err.stack);
        }

        if (m_result) {
            var m_data = convert_db_to_json_match(m_data);
            res.writeHead(200);
            res.write(JSON.stringify(m_data));
            res.end();

        } else {
            res.writeHead(404);
            res.end();
        }
    })
})


//3
// start a new match 
app.post('/match', (req, res) => {
    var query = req.query;
    const db = req.app.locals.db;

    var entry_fee = undef_to_num(query.entry_fee_usd_cents);
    var prize = undef_to_num(query.prize_usd_cents);

    if (!query.p1_id || !query.p2_id) {
        res.writeHead(404);
        res.end();
    } else if (!check_dig_str(query.entry_fee_usd_cents) || !check_dig_str(query.prize_usd_cents)) {
        res.writeHead(400);
        res.end();
    } else {
        var pido1 = new ObjectId(query.p1_id);
        var pido2 = new ObjectId(query.p2_id);

        db.collection(config_json.collection)
            .findOne({ _id: ObjectId(query.p1_id) }, function (err, p1_data) {

                if (!p1_data) {
                    res.writeHead(404);
                    res.end();
                } else {
                    db.collection(config_json.collection)
                        .findOne({ _id: ObjectId(query.p2_id) }, function (err, p2_data) {
                            if (!p2_data) {
                                res.writeHead(404);
                                res.end();
                            } else if (p1_data.in_active_match || p2_data.in_active_match) {
                                res.writeHead(409);
                                res.end();
                            } else if (p1_data.balance_usd_cents < entry_fee ||
                                p2_data.balance_usd_cents < entry_fee) {
                                res.writeHead(402);
                                res.end();
                            } else {
                                var date_now = new Date();
                                var insert_query = {
                                    created_at: date_now,
                                    ended_at: null,
                                    entry_fee_usd_cents: entry_fee,
                                    is_dq: false,
                                    p1_id: pido1,
                                    p1_points: undef_to_num(p1_data.total_points),
                                    p2_id: pido2,
                                    p2_points: undef_to_num(p2_data.total_points),
                                    prize_usd_cents: prize
                                }
                                db.collection('match')
                                    .insertOne(insert_query, function (err, insert_result) {
                                        if (err) {
                                            throw new Error(err.stack);
                                        } else {
                                            if (insert_result) {
                                                var inserted_id = insert_result.insertedId.toString();
                                                // print(insert_result);
                                                res.writeHead(303, { 'Location': '/match/' + inserted_id });
                                                res.end();
                                            } else {
                                                res.writeHead(400);
                                                res.end();
                                            }
                                        }
                                    })
                            }
                        })
                }
            });
    }
})



//4
app.post('/match/:mid/award/:pid', (req, res) => {
    var query = req.query;
    const db = req.app.locals.db;


    if (!check_dig_str(query.points)) {
        res.writeHead(400);
        res.end();
    } else {
        var points = undef_to_num(query.points);
        var winner_id = req.params.pid;
        var winnner_ido = new ObjectId(winnner_id);

        var mid = req.params.mid;
        var mido = new ObjectId(mid);

        db.collection('player').findOne({ "_id": winnner_ido }, function (err, p_data) {
            if (!p_data) {
                res.writeHead(404);
                res.end();
            } else {
                db.collection('match').findOne({ '_id': mido }, function (err, m_data) {
                    if (!m_data) {
                        res.writeHead(404);
                        res.end();
                    } else if (m_data.is_active == false) {
                        res.writeHead(409);
                        res.end();
                    } else if (p_data.in_active_match != mid) {
                        res.writeHead(400);
                        res.end();
                    } else {
                        db.collection('player').updateOne()
                        res.writeHead(200);
                        res.end();
                    }
                })
            }
        })


    }


})
// 5
app.post('/match/:mid/end', (req, res) => {
    // find the match 
    let query = req.query;
    let mid = req.params.mid;
    let mido = new ObjectId(mid);
    const db = req.app.locals.db;

    db.collection('match').findOne({ '_id': mido }, function (err, m_result) {
        if (err) throw new Error(err.stack);
        if (m_result) {
            // not active or  tied => 409 
            if (!m_result.is_active || m_result.p1_points == m_result.p2_points) {
                res.writeHead(409);
                res.end();
            } else {
                let now_date = new Date();
                // construct m_update_query
                let m_update_query = {
                    ended_at: now_date,
                }
                // award prize to win player  
                let win_ply;
                if (m_result.p1_points > m_result.p2_points) {
                    win_ply = m_result.p1_id;
                } else {
                    win_ply = m_result.p2_id;
                }
                // update winplayer 
                db.collection('player').updateOne(
                    { _id: ObjectId(win_ply) },
                    { $inc: { total_prize_usd_cents: m_data.prize_usd_cents } },
                    function (err, ply_update_result) {
                        if (err) throw new Error(err.stack);

                        if (ply_update_result && ply_update_result.length == 1) {

                            // update match, update ended_at, update is_active 
                            db.collection('match').updateOne({ _id: mido },
                                { $set: { ended_at: Date(), is_active: false } },
                                function (err, mch_update_result) {
                                    if (err) throw new Error(err.stack);
                                    if (mch_update_result && mch_update_result.length == 1) {
                                        // construct a response json 
                                        let m_json = {

                                        }

                                        // success => 200 
                                        res.writeHead(200);
                                        // response json is match object
                                        res.write(JSON.stringify());
                                        res.end();
                                    } else { throw new Error("update_fail"); }
                                })


                        } else { throw new Error('ply_update_fail') }
                    })
            }
        } else {
            res.writeHead(404);
            res.end();
        }
    })
})



//6 
app.post('/match/:mid/disqualify/:pid', (req, res) => {
    let mid = req.params.mid;
    let pid = req.params.pid;


    db.collection('match').findOne(
        { _id: ObjectId(mid) },
        function (err, m_result) {
            if (err) throw new Error(err.stack);

            if (m_result){
                if (!m_result.is_active){
                    res.writeHead(409);
                    res.end();
                }else{
                    // find player 
                    db.collection('player').findOne(
                        {_id: ObjectId(pid)},
                        function (err, ply_result){
                            if (err) throw new Error(err.stack);
                            if (ply_result){
                                
                            }
                        }
                    )
                    
                }
            }else{
                res.writeHead(404);
                res.end();
            }
        })


})




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


function check_dig_str(str) {
    return /^[0-9]*$/.test(str);
}

exports.x = check_invalid_query



function print(a) {
    console.log(a);
}
