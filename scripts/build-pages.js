"use strict";

const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "..", "public");
const dest = path.join(__dirname, "..", "docs");

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(source, dest, { recursive: true });

console.log(`Synced ${source} -> ${dest}`);
