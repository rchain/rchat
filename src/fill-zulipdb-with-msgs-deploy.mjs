// Reference to TypeScript definitions for IntelliSense in VSCode
/// <reference path="../rnode-grpc-gen/js/rnode-grpc-js.d.ts" />

import grpcLib from '@grpc/grpc-js';
import util from 'util';

// RNode with environment parameters
import { rnodeService } from './rnode-env.mjs';

// Load .env file
import { config } from 'dotenv';
config();

import postgres from 'postgres';

/**
  * @param {object} arg
  * @param {typeof path} arg.path
  */
async function main(env, {grpcLib}) {
  const zulip_db_config = {
    host: 'localhost',
    port: 5432,
    database: 'zulip',
    username: 'zulip',
    password: process.env.POSTGRES_PASSWORD,
  };
  
  const { DB_CONTRACT_URI } = env;

  // Postgres connection
  const sql = postgres(zulip_db_config);

  // FIXME this function is returning just zerver_message and zerver_usermessage
  function getTables(){
    return `
      new return,
        lookup(\`rho:registry:lookup\`)
      in {
        new dbCh, tablesCh in {
          lookup!(\`${DB_CONTRACT_URI}\`, *dbCh) |
          for (db <- dbCh) {
            db!("tables", *tablesCh) |
            for (@tables <- tablesCh) {
              return!(("Tables", tables))
            }
          }
        }
      }
    `;
  } 

  function getTableKeys(tableName){
    return `
      new return,
        lookup(\`rho:registry:lookup\`)
      in {
        new dbCh, keysCh in {
          lookup!(\`${DB_CONTRACT_URI}\`, *dbCh) |
          for (db <- dbCh) {
            db!("keys", "${tableName}", *keysCh) |
            for (@keys <- keysCh) {
              return!(("keys", keys))
            }
          }
        }
      }
    `;
  }

  function getRecordInDB(table, ids){
    return `
      new return,
        lookup(\`rho:registry:lookup\`)
      in {
        new dbCh, selectCh in {
          lookup!(\`${DB_CONTRACT_URI}\`, *dbCh) |
          for (db <- dbCh) {
            db!("select", "${table}", [${ids}], *selectCh) |
            for (@keys <- selectCh) {
              return!(("select", keys))
            }
          }
        }
      }
    `;
  }

  //TODO does exist a library that could make me avoid this messy code to extract data?
  function getTablesNames(result) {
    const tables = [];
    const exprsList = result.postblockdataList[0]?.exprsList;
    if (exprsList){
      const objList = exprsList[0]?.eTupleBody.psList;
      for (let obj of objList) {
        let body = obj.exprsList[0]?.eSetBody;
        if (body) {
          for (let list of body.psList) {
            let setBody = list.exprsList[0]?.gString;
            tables.push(setBody);
          }
        }
      }
    }
    return tables;
  }  
  
  function getKeysFromAST(result) {
    const msgKeys = []
    const exprsList = result.postblockdataList[0]?.exprsList;
    const objList = exprsList.length > 0 ? exprsList[0]?.eTupleBody.psList : [];
    for (let obj of objList) {
      let body = obj.exprsList[0]?.eTupleBody;
      if (body) {
        for (let list of body.psList) {
          let setBody = list.exprsList[0]?.eSetBody;
          if (setBody) {
            for (let el of setBody.psList) {
              msgKeys.push(el.exprsList[0].gInt);
            }
          }
        }
      }
    }
    return msgKeys;
  }

  function getDatafromAST(dataList){
    let messages = [];
    for (let msgData of dataList){
      let tupleBody = msgData.exprsList[0]?.eTupleBody;
      if (tupleBody != undefined){
        for (let list of tupleBody.psList){
          if (list.exprsList[0]?.eMapBody != undefined){
            let dataList = list.exprsList[0]?.eMapBody.kvsList;
            for (let data of dataList){
              let mapBody = data.value.exprsList[0]?.eMapBody;
              if (mapBody != undefined){
                let msg = {};
                msg["id"] = data.key.exprsList[0]?.gInt;
            
                for (let dictEl of mapBody.kvsList){
                  if (dictEl.value){
                    let key = dictEl.key.exprsList[0]?.gString;
                    let valueSt = dictEl.value.exprsList[0]?.gString;
                    let valueInt = dictEl.value.exprsList[0]?.gInt;
                    let valueBool = dictEl.value.exprsList[0]?.gBool;
                    let value =  valueSt || valueInt || valueBool;
                    msg[key] = value;
                  }
                }
                messages.push(msg);
              }
            }
          }
        }
      }
    }
    return messages;
  }

  async function saveDataToDB(sql, tableName, data, keys, returnIds) {
    try {
      const insertedRecords = await sql`INSERT INTO ${sql(tableName)} ${sql(data, ...keys)} returning id`;
      console.log("# of records inserted:", data.length);
      if (returnIds){
        return insertedRecords;
      }
    } catch (error) {
      console.error("Postgres insert error: "+error);
      await sql.end();
    }
  }

  // RNode connection
  const { exploratoryDeploy } = rnodeService(env, grpcLib);
  let insertedIds = [];
  // Get tables to get data
  let {result} = await exploratoryDeploy({term: getTables()});
  const tablesNames = getTablesNames(result);
  
  for (let table of tablesNames){
    let returnIds = false;
    // Get ids for tables
    let {result} = await exploratoryDeploy({term: getTableKeys(table)});
    const recordKeys = getKeysFromAST(result);

    // Get data by ids
    let {result: resultRecords} = await exploratoryDeploy({term: getRecordInDB(table, recordKeys)});
    const tableDataList = resultRecords.postblockdataList[0]?.exprsList[0]?.eTupleBody.psList;
    let tableData = getDatafromAST(tableDataList);
  
    // console.log('RESULT', util.inspect(result, {depth: 100, colors: true}));
    if (table == "zerver_message"){
      returnIds = true;
    }

    if (table == "zerver_usermessage" && insertedIds.length){
      returnIds = false;
      // updating zerver_usermessage.message_id with new msgs ids after adding them to pg db
      //TODO if onchain returns more than current tables
      // we should consider updating zerver_usermessage first and then the rest of tables that depends on it
      for (let i = 0; i < tableData.length; i++){
        tableData[i].message_id = insertedIds[i].id;
      }
    } 
    let keys = Object.keys(tableData[0]).map(w => w.toString());
    keys.shift(); //removing id

    insertedIds = await saveDataToDB(sql, table, tableData, keys, returnIds);
  }
  sql.end();
};



await main(process.env, {grpcLib, postgres});