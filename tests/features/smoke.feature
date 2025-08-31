Feature: Smoke (atomic steps)
  As a user of the framework
  I want a smoke scenario built from atomic UI steps
  So anyone new can scale tests by composing simple actions

  @smoke @login
  Scenario: Login and land on home
    Given Read the test data for "<ScenarioID>" from "<ScenarioSheet>"
    Given Login into the Velocity Application using user "<LoginID>" from environment sheet "<LoginSheetDetails>"
    When I click "velocity.link"
    When I open Add and start a new Application
    Given I fill the initial application details
    When I fill additional borrowers

    Examples: 
    |ScenarioID     |ScenarioSheet    | LoginID                |LoginSheetDetails      |
    |SC01           |EndToEnd         | scotia-admin           |SIT                    |


    # |SC02           |EndToEnd         | velocity_testerone     |SIT                    |
