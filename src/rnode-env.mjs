// Reference to TypeScript definitions for IntelliSense in VSCode
/// <reference path="../rnode-grpc-gen/js/rnode-grpc-js.d.ts" />
// @ts-check

import { signDeploy, rnodeDeploy, rnodePropose, getAddrFromPrivateKey } from '@tgrospic/rnode-grpc-js';
// requires --experimental-json-modules
import protoSchema from '../rnode-grpc-gen/js/pbjs_generated.json';
import '../rnode-grpc-gen/js/DeployServiceV1_pb.js'; // proto global
import '../rnode-grpc-gen/js/ProposeServiceV1_pb.js'; // proto global

/**
 * Creates RNode client methods via gRPC
 *
 * @param env Connection parameters (from .env file)
 * @param grpcLib gRPC library used for communication with RNode (@grpc/grpc-js)
 * @returns Deploy and propose operations to RNode
 */
export function rnodeService(env, grpcLib) {
  /* Environment variables (.env file) */
  const { MY_NET_IP, VALIDATOR_BOOT_PRIVATE } = env

  if (!VALIDATOR_BOOT_PRIVATE) throw Error(`Environment parameter not set VALIDATOR_BOOT_PRIVATE, check .env file.`);

  // Validator (boot) node
  const deployService = rnodeDeploy({ grpcLib, host: `${MY_NET_IP}:40401`, protoSchema });
  const proposeService = rnodePropose({ grpcLib, host: `${MY_NET_IP}:40402`, protoSchema });
  const secretKey = VALIDATOR_BOOT_PRIVATE;
  const phloLimit = 10e7;

  // Read-only node
  const deployServiceRead = rnodeDeploy({ grpcLib, host: `${MY_NET_IP}:40411`, protoSchema });

  // Exports
  const sendDeploy        = makeSendDeploy({deployService, secretKey, phloLimit});
  const getDeployResult   = makeGetDeployResult({deployService})
  const exploratoryDeploy = makeExploratoryDeploy({deployService: deployServiceRead})
  const proposeBlock      = proposeService.propose;

  return {
    sendDeploy, getDeployResult, exploratoryDeploy, proposeBlock,
  }
}

/**
 * @param {Object} arg
 * @param {import('@tgrospic/rnode-grpc-js').DeployService} arg.deployService
 * @param {string} arg.secretKey
 * @param {number} arg.phloLimit
 */
function makeSendDeploy({ deployService, secretKey, phloLimit }) {
  // Deployer info
  const keyInfo = getAddrFromPrivateKey(secretKey);
  console.log({deployerKey: keyInfo.pubKey, revAddr: keyInfo.revAddr });

  /**
    * @param {Object} arg
    * @param {string} arg.term
   */
  return async ({ term }) => {
    // Get latest block number
    const [{ blockinfo: { blocknumber } }] = await deployService.getBlocks({ depth: 1 });

    const validafterblocknumber = blocknumber;
    console.log({ validafterblocknumber, phloLimit });

    const deployData = {
      term,
      phloprice: 1,  // TODO: when rchain economics evolve
      phlolimit: phloLimit,
      validafterblocknumber,
      timestamp: Date.now(), // TODO: ambient access, move to input parameter
    };
    // Sign deploy
    const signed = signDeploy(secretKey, deployData);
    console.log({ timestamp: signed.timestamp, term: term.slice(0, 50) });

    // Send deploy
    const deployResponse = await deployService.doDeploy(signed);

    return {
      sig: signed.sig,
      response: deployResponse,
    };
  }
}

/**
 * @param {Object} arg
 * @param {import('@tgrospic/rnode-grpc-js').DeployService} arg.deployService
 */
function makeGetDeployResult({ deployService }) {
  /**
    * @param {Object} arg
    * @param {Uint8Array} arg.sig Deploy signature (ID)
   */
  return async ({ sig }) => {
    // Get result from deploy
    const listenData = await deployService.listenForDataAtName({
      depth: 1,
      name: { unforgeablesList: [{gDeployIdBody: { sig }}] },
    });

    return listenData;
  };
}

/**
 * @param {Object} arg
 * @param {import('@tgrospic/rnode-grpc-js').DeployService} arg.deployService
 */
function makeExploratoryDeploy({ deployService }) {
  /**
    * @param {Object} arg
    * @param {string} arg.term Rholang term to execute
   */
  return async ({ term }) => {
    // Get result from exploratory deploy
    return await deployService.exploratoryDeploy({ term });
  };
}
