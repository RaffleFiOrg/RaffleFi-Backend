import { CheckpointConfig } from "@snapshot-labs/checkpoint";
import { ticketsContract, mainContract } from "./constants";
import { events } from "./events";

export const config: CheckpointConfig = {
    network: "goerli-alpha",
    sources: [
        {
            contract: mainContract,
            start: 185778,
            deploy_fn: "handleDeploy",
            events: [
                {
                name: "new_raffle_created",
                fn: "handleNewRaffleCreated",
                }
            ],
        }, 
    ]
  };