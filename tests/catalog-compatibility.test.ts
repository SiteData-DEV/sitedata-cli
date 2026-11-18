import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCatalog} from '../src/catalog.js';
import {parseCommandParameters} from '../src/arguments.js';
import {callApi} from '../src/api-client.js';
import {VERSION} from '../src/config.js';
import {trafficDefinition} from './fixtures.js';
import type {PublicApiDefinition} from '../src/types.js';

const definition: PublicApiDefinition = {...trafficDefinition, method:'POST', readOnly:false, path:'/api/v1/tasks/{jobId}', inputSchema:{type:'object',properties:{jobId:{type:'string'},inputs:{type:'array',items:{type:'object'}},metadata:{type:'object'},empty:{type:'string'}},required:['jobId','inputs']}};
const envelope = (apis: unknown[]) => ({code:'ok',data:{schemaVersion:1,apis}});

test('catalog supports POST and camelCase placeholders while rejecting invalid paths and duplicates', () => {
  assert.equal(parseCatalog(envelope([definition]))[0]?.path,definition.path);
  for (const path of ['/api/v1/tasks/{bad','/api/v1/../private','https://evil.test/api/v1/tasks']) {
    assert.throws(()=>parseCatalog(envelope([{...definition,path}])));
  }
  assert.throws(()=>parseCatalog(envelope([definition,definition])));
});

test('CLI JSON inputs reach POST intact and path values are encoded and excluded from payload', async () => {
  const parameters = parseCommandParameters(definition,['--job-id','a/b','--inputs','[{"prompt":"hello, world"}]','--metadata','{"label":"x,y"}','--empty=']);
  let calls=0;
  const fetcher: typeof fetch = async (input,init) => {
    calls++;
    assert.equal(String(input),'https://example.test/api/v1/tasks/a%2Fb');
    assert.equal(init?.method,'POST');
    assert.equal(new Headers(init?.headers).get('content-type'),'application/json');
    assert.ok(new Headers(init?.headers).get('user-agent')?.endsWith('/'+VERSION));
    assert.deepEqual(JSON.parse(String(init?.body)),{inputs:[{prompt:'hello, world'}],metadata:{label:'x,y'},empty:''});
    return Response.json({code:'ok'});
  };
  await callApi({baseUrl:'https://example.test',definition,parameters,credential:'test',timeoutMs:1000,fetch:fetcher});
  await assert.rejects(callApi({baseUrl:'https://example.test',definition,parameters:{},credential:'test',timeoutMs:1000,fetch:fetcher}),/Missing path parameter/);
  assert.equal(calls,1);
  assert.throws(()=>parseCommandParameters(definition,['--job-id','a','--inputs','[1]']),/invalid JSON type/);
  assert.throws(()=>parseCommandParameters(definition,['--job-id','a','--inputs','oops']),/valid JSON/);
});

test('GET replaces placeholders and retains existing repeated array query behavior', async () => {
  await callApi({baseUrl:'https://example.test',definition:{...definition,method:'GET'},parameters:{jobId:'a/b',tag:['a','b']},credential:'test',timeoutMs:1000,fetch:async (input,init)=>{
    assert.equal(String(input),'https://example.test/api/v1/tasks/a%2Fb?tag=a&tag=b');
    assert.equal(init?.body,undefined);
    return Response.json({code:'ok'});
  }});
});
