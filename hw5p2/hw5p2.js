const fs = require('fs');
const http = require('http');
const { reject } = require('lodash');
const { number, ParenthesisNodeDependencies } = require('mathjs');
const { ObjectId } = require('mongodb');
const { resolve } = require('path');
const url = require('url');
const express = require('express')
const app = express()
const port = 3000

// 1
app.get('/match', (req, res) => {
    // return matches sorted by prize_usd_cents DESC
    res.writeHead(204);
    res.end();

})

// 2
app.get('/match/:mid', (req, res) => {
    res.writeHead(204);
    res.end();



})

//3
// start a new match 
app.post('/match', (req, res) => {
    var query = req.query;
    print(query)

    if (!query.p1_id || !query.p2_id) {
        res.writeHead(404);
        res.end();
    } else {
        var pid1_in_actmth = false;
        var pid2_in_actmth = false;
        var pid1_blc = 100;
        var pid2_blc = 100;

        var entry_fee = undef_to_num(query.entry_fee_usd_cents);

        p_find(query.p1_id, mongo_url).then(
            (player_data) => {
                pid1_in_actmth = player_data.in_active_match;
                print('fuck')
                print(player_data.in_active_match)
            }, (err) => { throw new Error('check_palyer_in_act_match_error'); });

        p_find(query.p2_id, mongo_url).then(
            (player_data) => {
                pid2_in_actmth = player_data.in_active_match;
            }, (err) => { throw new Error('check_palyer_in_act_match_error'); });

        print(pid1_in_actmth)
        print(pid2_in_actmth)
        print(pid1_blc)
        print(pid2_blc)

        if (pid1_in_actmth || pid2_in_actmth) {
            res.writeHead(409);
            res.end();
        } else if (pid1_blc < entry_fee || pid2_blc < entry_fee) {
            res.writeHead(402);
            res.end();
        } else {
            // 

            res.writeHead(303, { 'Location': '' });
            res.end();
        }

    }


})

// function check_player_in_act_match(pid) {
//     p_find(pid, mongo_url).then(
//         (player_data) => {
//             if (player_data.in_active_match) {
//                 return false;
//             } else {
//                 return true
//             }
//         },

//         (err) => {
//             throw new Error('check_palyer_in_act_match_error');
//         });
// }


//4
app.post('/match/:mid/award/:pid', (req, res) => {
    req.query
    res.writeHead(204);
    res.end();

})
// 5
app.post('/match/:mid/end', (req, res) => {

    res.writeHead(204);
    res.end();

})
//6 
app.post('/match/:mid/disqualify/:pid', (req, res) => {

    res.writeHead(204);
    res.end();

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

        p_insert(document, mongo_url).then(
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

const mg_client = MongoClient.connect(mongo_url);




app.listen(port, () => {
    // console.log(`Example app listening on port ${port}`)
})

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





function p_insert(insert_query, mongo_url) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(mongo_url, function (err, db) {
            if (err) {
                process.exit(5);
            }
            var dbo = db.db(config_json.db);
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
                db.close()
            });
        });
    })
}

exports.x = check_invalid_query



function print(a) {
    console.log(a);
}
