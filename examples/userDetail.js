const anchor = require("@project-serum/anchor");
const stakingClient = require('../classes/stakingClient')
const idl = require("../idls/idl.json");

const ADDRESS_TO_LOOKUP                 = new anchor.web3.PublicKey(
    "9nyXwvzzfh51irxBwvrU4MRjMkynDVuN4JBrbZyvaHJQ"
);
const STAKING_PROGRAM_ADDRESS           = new anchor.web3.PublicKey(
    JSON.parse(JSON.stringify(idl['program']['staking.programId']))
);

const provider = anchor.Provider.local('https://api.mainnet-beta.solana.com');
anchor.setProvider(provider);

  (async () => {
    try {
        // Get user balances
        let balances = await stakingClient.getMemberBalances(
            provider.connection, 
            STAKING_PROGRAM_ADDRESS, 
            ADDRESS_TO_LOOKUP
        );

        console.log(balances);
    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();