#!/usr/bin/env node
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { cli } from "./cli.js";
import { ClackDisplay } from "./Display.js";

const mainLayer = Layer.merge(NodeContext.layer, ClackDisplay.layer);

cli(process.argv).pipe(Effect.provide(mainLayer), NodeRuntime.runMain);
