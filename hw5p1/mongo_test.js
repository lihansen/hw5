const fs = require('fs');
const http = require('http');
const { reject } = require('lodash');
const { number, ParenthesisNodeDependencies } = require('mathjs');
// const { reject } = require('lodash');
const { ObjectId } = require('mongodb');
const { resolve } = require('path');
const url = require('url');
const express = require('express')
const app = express()
const port = 3000



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

const client = new MongoClient(mongo_url);

async function mg_conn(){
    await client.connect();
    return client.db(config_json.db);
}

var dbo = mg_conn();

dbo.collection(config_json.collection).find({}).toArray(function(err, result) {
    console.log(result)
})

// MongoClient.connect(mongo_url, function (err, db) {
//     if (err) {
//         process.exit(5);
//     }
//     var dbo = db.db(config_json.db);
//     dbo.collection(config_json.collection).insertOne(insert_query, function (err, result) {
//         if (err) {
//             print('insert:error:')
//             print(err)
//             throw new Error(err);
//         }

//         if (result) {
//             resolve(result);
//         } else {
//             reject(new Error('insert reject'));
//         }
//         db.close()
//     });
// });
