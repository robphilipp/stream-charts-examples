### some context

The application uses a few libraries that you don't need to use. But you may need to provide similar functionality for
some of them. The following sections describe the libraries, their use, and whether you need to provide similar
functionality for them if you choose not to use them.

| library                                                                                  | app | library |
|------------------------------------------------------------------------------------------|-----|---------|
| [d3](https://www.npmjs.com/package/d3)                                                   | yes | yes     |
| [react-resizable-grid-layout](https://www.npmjs.com/package/react-resizable-grid-layout) | yes | yes     |

#### charts need to know their size

The application's entry point is the [main.tsx]() file. It wraps the [App.tsx]() component with
a [WindowDimensionsProvider]() from
the [react-resizable-grid-layout](https://www.npmjs.com/package/react-resizable-grid-layout) library. 