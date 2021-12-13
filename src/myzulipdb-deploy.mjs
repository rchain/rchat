// Reference to TypeScript definitions for IntelliSense in VSCode
/// <reference path="../rnode-grpc-gen/js/rnode-grpc-js.d.ts" />

import grpcLib from '@grpc/grpc-js';
import { promises as fs } from 'fs'
import util from 'util';

// RNode with environment parameters
import { rnodeService } from './rnode-env.mjs';

// Load .env file
import { config } from 'dotenv';
config();

/**
  * @param {object} arg
  * @param {typeof file} arg.fs
  * @param {typeof path} arg.path
  */
async function main(env, {fs, grpcLib}) {
  const { IDDB_CONTRACT_URI } = env
  if (!IDDB_CONTRACT_URI) throw Error(`Environment parameter not set IDDB_CONTRACT_URI, check .env file.`);

  // Get content of 'iddb.rho' file
  const rhoFile = new URL('myzulipdb.rho', import.meta.url);
  const rhoCodeTemplate = await fs.readFile(rhoFile, 'utf8');
  const rhoCode = rhoCodeTemplate.replace(/__ID_DB_URI__/, IDDB_CONTRACT_URI);

  // RNode connection
  const { sendDeploy, getDeployResult, proposeBlock } = rnodeService(env, grpcLib);

  // Send `iddb.rho` deploy
  const {response: deployResponse, sig} = await sendDeploy({term: rhoCode});
  console.log({ deployResponse });

  // Propose block
  const proposeResponse = await proposeBlock();
  console.log({ proposeResponse });

  // Get registered URI (sent on `rho:rchain:deployId`)
  const deployResult = await getDeployResult({sig});
  // console.log({deployResult: util.inspect(deployResult, {depth: 10, colors: true})});

  // Extract registry URI
  const uri = deployResult.payload?.blockinfoList[0]?.postblockdataList[0]?.exprsList[0]?.gUri;
  console.log({uri});
  console.log(`Copy URI to .env file DB_CONTRACT_URI variable.`);
};

await main(process.env, {fs, grpcLib});
