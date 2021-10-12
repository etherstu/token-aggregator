import express from "express";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { NameRegistryState, TokenData } from "@bonfida/spl-name-service";
import bs58 from "bs58";

const PORT = process.env.PORT || 5000;
const NAME_PROGRAM = "namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX";
const TOKEN_TLD = "6NSu2tci4apRKQtt257bAVcvqYjB3zV2H1dWo56vgpa6";
const CACHE_TIME = 15 * 60; // 15 minutes
const REFRESH_INTERVAL = CACHE_TIME * 1000;

const connection = new Connection(clusterApiUrl("mainnet-beta"));

let autocompleteList = JSON.stringify([]);

(async () => {
  await refreshList();

  express()
    .use((_, res) => {
      res.set("Cache-control", `public, max-age=${CACHE_TIME}`);
    })
    .get("/", (_, res) => res.send("Token List Aggregator"))
    .get("/token-autocomplete.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(autocompleteList);
    })
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

  setInterval(async () => {
    await refreshList();
  }, REFRESH_INTERVAL);
})();

async function refreshList() {
  try {
    let accts = await connection.getProgramAccounts(
      new PublicKey(NAME_PROGRAM),
      {
        filters: [
          {
            memcmp: {
              bytes: new PublicKey(TOKEN_TLD).toBase58(),
              offset: 0,
            },
          },
        ],
      }
    );

    const results = [];

    for (let acct of accts) {
      try {
        const res = TokenData.deserialize(
          acct.account.data.slice(NameRegistryState.HEADER_LEN)
        );
        results.push({
          name: res.name,
          symbol: res.ticker,
          mint: bs58.encode(res.mint),
        });
      } catch (error) {}
    }

    autocompleteList = JSON.stringify(results);
  } catch (error) {
    console.error(error);
  }
}