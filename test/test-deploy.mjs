// Reference to TypeScript definitions for IntelliSense in VSCode
/// <reference path="../rnode-grpc-gen/js/rnode-grpc-js.d.ts" />
// @ts-check

import grpcLib from '@grpc/grpc-js';
import test from 'tape';

// RNode with environment parameters
import { rnodeService } from '../src/rnode-env.mjs';

// Load .env file
import { config } from 'dotenv';
config();

import { rhoParToJson } from '@tgrospic/rnode-grpc-js';

test('deploy test (required running RNode service defined in docker-compose.yml)', async t => {
  // RNode connection
  const { sendDeploy, getDeployResult, proposeBlock } = rnodeService(process.env, grpcLib);

  // Rholang term
  const term = `new return(\`rho:rchain:deployId\`) in { return!(42) }`;

  // Send deploy
  const {response: deployResponse, sig} = await sendDeploy({term});
  console.log({ deployResponse });

  t.match(deployResponse.result, /^Success!\nDeployId is: [0-9a-fA-F]+$/, `Test send deploy`);

  // Propose block
  const proposeResponse = await proposeBlock();
  console.log({ proposeResponse });

  t.match(proposeResponse.result, /^Success! Block [0-9a-fA-F]+ created and added.$/, `Test block propose`);

  // Deploy result
  const deployResult = await getDeployResult({sig});

  // Raw data (Par objects) returned from Rholang
  const par = deployResult.payload.blockinfoList[0].postblockdataList[0];

  // Rholang term converted to JSON
  // NOTE: Only part of Rholang types are converted:
  //       primitive types, List, Set, object (Map), Uri, ByteArray, unforgeable names.
  const rhoResult = rhoParToJson(par);

  t.equal(rhoResult, 42, `Test deploy result`);
});
