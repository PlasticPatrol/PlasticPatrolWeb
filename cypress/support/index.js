// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Alternatively you can use CommonJS syntax:
// require('./commands')

beforeEach(() => {
  cy.window().then((win) => {
    // ensures users aren't persisted between tests
    win.indexedDB.deleteDatabase("firebaseLocalStorageDb");
    win.localStorage.clear();

    // assume we're not a brand new user for most tests
    win.localStorage.setItem("welcomeShown", "true");
    win.localStorage.setItem("termsAccepted", "Yes");
  });

  cy.log("running");
  cy.viewport("iphone-5");
});
