// Reference to TypeScript definitions for IntelliSense in VSCode
/// <reference path="../rnode-grpc-gen/js/rnode-grpc-js.d.ts" />

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

  const deployService = rnodeDeploy({ grpcLib, host: `${MY_NET_IP}:40401`, protoSchema });
  const proposeService = rnodePropose({ grpcLib, host: `${MY_NET_IP}:40402`, protoSchema });
  const secretKey = VALIDATOR_BOOT_PRIVATE;
  const phloLimit = 10e7;

  // Exports
  const sendDeploy      = makeSendDeploy({deployService, secretKey, phloLimit});
  const getDeployResult = makeGetDeployResult({deployService})
  const proposeBlock    = proposeService.propose;

  return {
    sendDeploy, getDeployResult, proposeBlock,
  }
}

/**
 * @param {Object} arg
 * @param {import('@tgrospic/rnode-grpc-js').DeployService} arg.deployService
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
    * @param {string} arg.sig Deploy signature (ID)
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
