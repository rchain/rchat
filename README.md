# RChat - RChain support to decentralize chat (Zulip)

Show case example how to make chat applications like Zulip decentralized with on-chain data.

## Goal

1. Extract chat messages from Zulip and store it on-chain.
1. Read on-chain tables, keys and messages.
1. Import messages to Zulip.

## Install nodejs dependencies

```sh
npm install
```

## Run local Zulip server with RChain nodes

Control of the whole process is defined with `npm` scripts in [package.json](package.json).

The first step is to start Zulip with its dependencies and RNode instances which will store on-chain data. Starting from fresh it will take a few minutes to complete. Check _docker-compose_ logs and web access for more info.

_TODO: Read-only RNode is defined in configuration but not currently used. Additional info should be provided how to read exported on-chain data._

```sh
npm run start-docker
```

To control docker-compose services which includes both [docker-compose.yml](docker-compose.yml) and [docker-compose-zulip.yml](docker-compose-zulip.yml) this npm script can be used.

```sh
# Get logs from all containers
npm run dc -- logs -f

# Get logs only from bootstrap RNode
npm run dc -- logs -f boot
```

### Check when Zulip and RNode are started from the browser

Zulip: [https://localhost:1443/](https://localhost:1443/).  
RNode: [http://localhost:40403/status](http://localhost:40403/status).

# Configure initial Zulip account (organization)

To login to a locally started Zulip instance it's necessary to follow the Zulip procedure and create an organization with an initial account.

This command will print a temporary link to access the initial Zulip configuration. Follow the link, create your account and login to Zulip server.

```sh
npm run zulip-gen-org-link
```

## Configure smart contract to store chat messages

This step is necessary to execute only once when RChain nodes are started from a fresh state.

Creates a main contract with operations to insert DB data on-chain.

**Result of these deploys will produce URI output which must be updated in [**.env**](.env) file.**

```sh
npm run iddb-deploy
```

After __.env__ file is updated with __IDDB_CONTRACT_URI__ execute command to create a contract for Zulip DB.

```sh
npm run myzulipdb-deploy
```

Update __DB_CONTRACT_URI__ in __.env__ file which is used as part of private channel for insert operations ([chain_replica.mjs](chain_replica.mjs)) and to get read-only channel for read operations ([read-db.mjs](read-db.mjs)).

_NOTE: Whenever `iddb-deploy` and `myzulipdb-deploy` are deployed again the corresponding record in __.env__ file must be updated._

## Start JS script to process new messages from Zulip and import on-chain

```sh
npm start
```

## Run JS script to import on-chain messages to new Zulip instance

When creating a new instance of Zulip, you can import on-chain messages by running these script. It will copy the data from obtained on-chain tables. 

```sh
npm run fill-zulipdb
```

_TODO: At the moment of this change, the function getTables (from on-chain) returns only zerver_message and zerver_usermessage tables, but there are a few more related to zerver_message such as zerver_userprofile. Copying those tables related to zerver_message could be an improvement to what it is done here._


## Stop containers and clean data

Stop and remove all containers (data stored on disk will not be touched).

```sh
npm run dc -- down
```

Delete all data on disk. `sudo` is needed because RNode uses _root_ user inside the container, so the mounted folder will be owned by _root_. 

```sh
sudo rm -R data
```
