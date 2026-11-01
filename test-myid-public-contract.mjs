import assert from 'node:assert/strict';
import {publishedMyIDLinks} from './scripts/lib/myid-public-contract.mjs';
const html='<script>var et_link_options_data = [{"class":"et_pb_blurb_0_tb_header","url":"http:\\/\\/my.id-idiomas.com.br\\/login\\/auth","target":"_blank"},{"url":"https://evil.test/login"}];</script>';
assert.deepEqual(publishedMyIDLinks(html),['http://my.id-idiomas.com.br/login/auth']);
assert.deepEqual(publishedMyIDLinks('<a href="https://my.id-idiomas.com.br/login/auth">MyID</a>'),['https://my.id-idiomas.com.br/login/auth']);
assert.deepEqual(publishedMyIDLinks('<script>et_link_options_data = [maliciousCode()];</script>'),[]);
console.log('Public contract extraction passed: Divi JSON and direct links recognized without executing scripts or accepting unrelated hosts.');
