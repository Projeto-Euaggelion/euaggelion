# Código de terceiros

Partes deste pacote foram portadas (traduzidas para português e adaptadas ao estilo do monorepo) de
[trekhleb/bible-cross-references](https://github.com/trekhleb/bible-cross-references):

- `src/books.ts`: os 66 livros e ids OSIS;
- `src/kjv-versification.ts` e `src/versification.ts`: a versificação da KJV e os índices densos;
- `src/genres.ts`: o agrupamento dos livros em gêneros (nomes traduzidos);
- `src/names/pt.ts` e `src/names/en.ts`: os nomes dos livros;
- `src/book-lookup.ts`: a busca de livros tolerante a acentos;
- `src/reference.ts`: o padrão de leitura de livro e capítulo (os intervalos são do Euaggelion).

Licença original:

```
MIT License

Copyright (c) 2026 Oleksii Trekhleb

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
