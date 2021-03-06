describe("basic anonymous user functionality", () => {
  it("brand new users are shown the tutorial", () => {
    cy.window().then((win) => win.localStorage.clear());
    cy.visit("/");

    cy.contains("Next").should("be.disabled");

    cy.contains("I have read").click();

    cy.contains("Next").should("not.be.disabled").click();

    cy.getTestElement("NavDot-2").click();

    cy.contains("Get started").click();

    cy.contains("Record Your Litter");

    cy.reload();

    // check we persist that the welcome has been shown
    cy.contains("Next").should("not.exist");
  });

  it("anonymous users are prompted to sign in when they try to log a photo", () => {
    cy.contains("Record Your Litter").click();

    cy.contains("Please login to add a photo");
  });
});
