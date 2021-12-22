// Reference to TypeScript definitions for IntelliSense in VSCode
/// <reference path="../rnode-grpc-gen/js/rnode-grpc-js.d.ts" />
// @ts-check

import grpcLib from '@grpc/grpc-js';
import util from 'util';

// RNode with environment parameters
import { rnodeService } from './rnode-env.mjs';

// Load .env file
import { config } from 'dotenv';
config();

/**
  * @param {typeof process.env} env
  * @param {object} arg
  * @param {typeof grpcLib} arg.grpcLib Library '@grpc/grpc-js'
  */
async function main(env, {grpcLib}) {
  const { DB_CONTRACT_URI } = env
  if (!DB_CONTRACT_URI) throw Error(`Environment parameter not set DB_CONTRACT_URI, check .env file.`);

  const getTables = `
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
  `
  const getKeys = `
    new return,
      lookup(\`rho:registry:lookup\`)
    in {
      new dbCh, keysCh in {
        lookup!(\`${DB_CONTRACT_URI}\`, *dbCh) |
        for (db <- dbCh) {
          db!("keys", "zerver_message", *keysCh) |
          for (@keys <- keysCh) {
            return!(("keys", keys))
          }
        }
      }
    }
  `

  const getMessage = id => `
    new return,
      lookup(\`rho:registry:lookup\`)
    in {
      new dbCh, selectCh in {
        lookup!(\`${DB_CONTRACT_URI}\`, *dbCh) |
        for (db <- dbCh) {
          db!("select", "zerver_message", [${id}], *selectCh) |
          for (@keys <- selectCh) {
            return!(("select", keys))
          }
        }
      }
    }
  `

  // RNode connection
  const { exploratoryDeploy } = rnodeService(env, grpcLib);

  // Get ids for zerver_message table
  // const {result} = await exploratoryDeploy({term: getkeys});

  // Get message by id from zerver_message table
  const {result} = await exploratoryDeploy({term: getMessage(19)});

  console.log('RESULT', util.inspect(result, {depth: 100, colors: true}))
};

await main(process.env, {grpcLib});
