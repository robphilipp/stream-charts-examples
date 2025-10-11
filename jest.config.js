// Minimal Jest config; CRA uses package.json "jest" but IDE direct runs may read this file.
// Explicitly set reporters to prevent WebStorm from injecting jest-intellij-reporter which is failing.
module.exports = {
  reporters: ['default'],
};