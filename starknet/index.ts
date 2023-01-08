import Checkpoint from "@snapshot-labs/checkpoint";
import { config } from "./checkpointConfig";
import { writers } from "./dataWriters";
import { schema } from "./schema";

const checkpoint = new Checkpoint(config, writers, schema);
checkpoint.start();