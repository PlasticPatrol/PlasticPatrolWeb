import { moderator } from "../fixtures/users";
import { routes } from "../fixtures/common";

describe("routes", () => {
  it("checks that every route renders without instantly throwing an error", () => {
    cy.login(moderator.email, moderator.password);

    cy.visit(routes.account);
    cy.contains("Account");

    cy.visit(routes.leaderboard);
    cy.contains("Leaderboard");

    cy.visit(routes.tutorial);
    cy.contains("Tutorial");

    cy.visit(routes.about);
    cy.contains("About");

    cy.visit(routes.feedback);
    cy.contains("Feedback");

    cy.visit(routes.photoApproval);
    cy.contains("Photo Approval", { timeout: 20000 });

    cy.visit(routes.feedbackReports);
    cy.contains("Feedback");

    cy.visit(routes.newPhoto);
    cy.contains("Record your litter");
  });
});
