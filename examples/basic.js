"use strict";
var inquirer = require("inquirer");
inquirer.registerPrompt("search-checkbox", require("../dist"));

inquirer
	.prompt([
		{
			type: "search-checkbox",
			message: "Select toppings",
			name: "toppings",
			choices: [
				{
					name: "Pepperoni"
				},
				{
					name: "Ham"
				},
				{
					name: "Ground Meat"
				},
				{
					name: "Bacon"
				},
				{
					name: "Mozzarella"
				}
			],
			validate: function(answer) {
				if (answer.length < 1) {
					return "You must choose at least one topping.";
				}
				return true;
			}
		}
	])
	.then(function(answers) {
		console.log(JSON.stringify(answers, null, "  "));
	})
	.catch(e => console.log(e));
