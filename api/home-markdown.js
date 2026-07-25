const markdown = `---
title: Brett Red
author: Brett Red
description: Brett Red is a product design leader with 14 years of experience. This site is a collection of that work.
canonical: https://www.brett.red/
---

# Brett Red

Brett Red is a product design leader with 14 years of experience making products with great people. This portfolio collects selected work.

## Selected work

- [Anchor Maps](https://www.brett.red/anchormaps)
- [Arya](https://www.brett.red/arya)
- [Calendly](https://www.brett.red/calendly)
- [Document AI](https://www.brett.red/doc-ai)
- [FB](https://www.brett.red/fb)
- [Layer1](https://www.brett.red/layer1)
- [Levels](https://www.brett.red/levels)
- [Navdy](https://www.brett.red/navdy)

## About and approach

- [About Brett Red](https://www.brett.red/about)
- [AI product design](https://www.brett.red/ai-product-design)
- [Design engineering](https://www.brett.red/design-engineering)

## Contact

- [Book time with Brett](https://www.brett.red/calendly)
- [Full sitemap](https://www.brett.red/sitemap.xml)
`;

const tokenEstimate = Math.ceil(markdown.trim().split(/\s+/).length / 0.75);

module.exports = function handler(request, response) {
  const accept = request.headers.accept?.toLowerCase() ?? '';

  if (!accept.includes('text/markdown')) {
    response.status(406).setHeader('Vary', 'Accept').send('Not Acceptable');
    return;
  }

  response
    .status(200)
    .setHeader('Content-Type', 'text/markdown; charset=utf-8')
    .setHeader('Vary', 'Accept')
    .setHeader('X-Markdown-Tokens', String(tokenEstimate))
    .send(markdown);
};
