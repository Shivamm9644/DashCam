const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

// 1. Find all buttons
const buttonRegex = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
let match;
const buttons = [];
while ((match = buttonRegex.exec(html)) !== null) {
  const attrs = match[1];
  const text = match[2].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);
  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
  buttons.push({
    text: text.slice(0, 40),
    id: idMatch ? idMatch[1] : null,
    onclick: onclickMatch ? onclickMatch[1] : null,
    className: classMatch ? classMatch[1] : null,
    type: typeMatch ? typeMatch[1] : null
  });
}

console.log('=== TOTAL BUTTONS:', buttons.length, '===');
buttons.forEach((b, i) => {
  console.log(`${i+1}. [${b.text}] id="${b.id}" onclick="${b.onclick}" class="${b.className}"`);
});

// 2. Find all tabs
const tabRegex = /<button[^>]*class=["'][^"']*tab-pill[^"']*["'][^>]*>([\s\S]*?)<\/button>/gi;
// 3. Find all links with href or onclick
const aRegex = /<a([^>]*)>([\s\S]*?)<\/a>/gi;
const links = [];
while ((match = aRegex.exec(html)) !== null) {
  const attrs = match[1];
  const text = match[2].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  links.push({
    text: text.slice(0, 40),
    id: idMatch ? idMatch[1] : null,
    href: hrefMatch ? hrefMatch[1] : null,
    onclick: onclickMatch ? onclickMatch[1] : null
  });
}
console.log('\n=== TOTAL LINKS:', links.length, '===');
links.forEach((l, i) => {
  console.log(`${i+1}. [${l.text}] id="${l.id}" href="${l.href}" onclick="${l.onclick}"`);
});
