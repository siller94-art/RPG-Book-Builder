import { describe, it, expect } from 'vitest';
import { renderBrewPage } from './brewSource';

// Book source can come from files other people share (.rpgbook, Homebrewery text),
// so nothing in it may be able to add attributes or tags to the rendered page.
const hasInjectedHtml = (html: string) =>
  /<script/i.test(html) || /<[a-z][^>]*\son\w+\s*=/i.test(html) || /="[^"]*"\s*on\w+=/i.test(html);

describe('rendered book pages cannot be used to run code', () => {
  it.each([
    ['double quote in an image URL', '![m](https://e.com/x"onerror="alert`1`)'],
    ['single quote in an image URL', "![m](https://e.com/x'onerror='alert`1`)"],
    ['tag inside an image URL', '![m](https://e.com/x><script>alert`1`</script>)'],
    ['double quote in a link URL', '[m](https://e.com/x"onmouseover="alert`1`)'],
    ['raw HTML tag', '<img src=x onerror=alert(1)>'],
    ['raw script tag', '<script>alert(1)</script>'],
  ])('%s', (_name, source) => {
    expect(hasInjectedHtml(renderBrewPage(source))).toBe(false);
  });

  it('still renders ordinary web and embedded images', () => {
    expect(renderBrewPage('![map](https://e.com/a.png)')).toContain('<img src="https://e.com/a.png" alt="map">');
    expect(renderBrewPage('![d](data:image/png;base64,iVBORw0KGgo=)')).toContain('<img src="data:image/png;base64,iVBORw0KGgo=" alt="d">');
  });
});
