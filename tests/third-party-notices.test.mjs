import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('project licence and third-party notices have distinct scopes', () => {
  const notice = read('NOTICE');
  const readme = read('README.md');
  assert.match(read('LICENSE'), /^MIT License/);
  assert.match(notice, /does not relicense third-party materials/i);
  assert.match(readme, /third-party notices/i);
  assert.doesNotMatch(notice, /no third-party code or data is vendored/i);
});

test('bundled Tailwind JavaScript includes a separate MIT notice', () => {
  const license = read('js/tailwindcss.LICENSE.txt');
  assert.match(license, /^MIT License/);
  assert.match(license, /Tailwind Labs, Inc\./);
  assert.match(read('NOTICE'), /js\/tailwindcss\.LICENSE\.txt/);
});

test('bundled fonts include full SIL Open Font License notices', () => {
  for (const [file, author, reserved] of [
    ['fonts/OFL-Lora.txt', 'The Lora Project Authors', 'Lora'],
    ['fonts/OFL-Playfair-Display.txt', 'The Playfair Display Project Authors', 'Playfair Display']
  ]) {
    const license = read(file);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.ok(license.includes(author), file);
    assert.ok(license.includes('Reserved Font Name "' + reserved + '"'), file);
    assert.match(license, /PERMISSION & CONDITIONS/);
    assert.match(license, /TERMINATION/);
    assert.ok(read('NOTICE').includes(file), file);
  }
});
