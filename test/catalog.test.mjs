import assert from 'node:assert/strict';
import { normalizeHost, privateAddr } from '../api/catalog.js';
assert.equal(normalizeHost('https://Shop.Example.com/collections/all'), 'shop.example.com');
for (const bad of ['localhost', '127.0.0.1', 'http://169.254.169.254', 'a@b.com', 'x.com:8080', 'foo.internal', '', 'nodot']) assert.equal(normalizeHost(bad), null, bad);
for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.ok(privateAddr(ip), ip);
for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1']) assert.ok(!privateAddr(ip), ip);
console.log('catalog tests passed');
