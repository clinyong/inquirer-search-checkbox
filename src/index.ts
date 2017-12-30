import Base = require("inquirer/lib/prompts/base");
import observe = require("inquirer/lib/utils/events");
import figures = require("figures");
import Paginator = require("inquirer/lib/utils/paginator");
import chalk from "chalk";
import * as fuzzy from "fuzzy";

interface Event {
	key: {
		name: string;
		ctrl: boolean;
		meta: boolean;
	};
	value: string;
}

interface Choice extends Base.Choice {
	id: number;
}

const ignoreKeys = ["up", "down", "space"];

function getCheckbox(checked: boolean) {
	return checked ? chalk.green(figures.radioOn) : figures.radioOff;
}

function isSeparator(c: Base.Choice) {
	return c.type === "separator";
}

function renderChoices(choices: Choice[], pointer: number) {
	var output = "";

	choices.forEach(function(choice, i) {
		if (choice.disabled) {
			output = `${output} - ${choice.name} (Disabled)`;
		} else {
			var isSelected = i === pointer;
			output += isSelected ? chalk.cyan(figures.pointer) : " ";
			output += getCheckbox(choice.checked) + " " + choice.name;
		}

		output += "\n";
	});

	return output.replace(/\n$/, "");
}

class SearchBox extends Base {
	private pointer: number = 0;
	private selection: string[] = [];
	private done: (state: any) => void;
	private choices: Choice[] = [];
	private filterList: Choice[] = [];
	private paginator: Paginator = new Paginator();

	constructor(...params: any[]) {
		super(...params);
		const { choices } = this.opt;

		if (!choices) {
			this.throwParamError("choices");
		}

		const item = choices.find(c => isSeparator(c));
		if (item) {
			throw new Error("Separator is not allowed in choices.");
		}

		this.filterList = this.choices = choices
			.filter(() => true) // fix slice is not a function
			.map((item, id) => ({ ...item, id }));
	}

	render(error?: string) {
		// Render question
		var message = this.getQuestion();
		var bottomContent = "";
		const tip = chalk.dim("(Press <space> to select, <enter> to submit.)");

		// Render choices or answer depending on the state
		if (this.status === "answered") {
			message += chalk.cyan(this.selection.join(", "));
		} else {
			message += `${tip} ${this.rl.line}`;
			const choicesStr = renderChoices(this.filterList, this.pointer);
			bottomContent = this.paginator.paginate(
				choicesStr,
				this.pointer,
				this.opt.pageSize
			);
		}

		if (error) {
			bottomContent = chalk.red(">> ") + error;
		}

		this.screen.render(message, bottomContent);
	}

	filterChoices() {
		const options = {
			extract: (el: Choice) => el.name
		};

		this.filterList = fuzzy.filter(this.rl.line, this.choices, options).map(el => el.original);
	}

	toggleChoice(index: number) {
		const item = this.filterList[index];
		if (item) {
			this.choices[item.id].checked = !item.checked;
		}
	}

	onSpaceKey() {
		this.rl.line = this.rl.line.trim(); // remove space from input
		this.toggleChoice(this.pointer);
		this.render();
	}

	onDownKey() {
		const len = this.filterList.length;
		this.pointer = this.pointer < len - 1 ? this.pointer + 1 : 0;
		this.render();
	}

	onUpKey() {
		const len = this.filterList.length;
		this.pointer = this.pointer > 0 ? this.pointer - 1 : len - 1;
		this.render();
	}

	onAllKey() {
		const existCancel = this.filterList.find(item => !item.checked);
		this.filterList.forEach(item => {
			this.choices[item.id].checked = !!existCancel;
		});
		this.render();
	}

	onEnd(state: any) {
		this.status = "answered";

		// Rerender prompt (and clean subline error)
		this.render();

		this.screen.done();
		this.done(state.value);
	}

	onError(state: any) {
		this.render(state.isValid);
	}

	onKeyPress() {
		this.pointer = 0;
		this.filterChoices();
		this.render();
	}

	getCurrentValue() {
		const choices = this.choices.filter(
			item => item.checked && !item.disabled
		);

		this.selection = choices.map(item => item.short);
		return choices.map(item => item.value);
	}

	_run(cb: any) {
		this.done = cb;

		const events = observe(this.rl);
		const upKey = events.keypress.filter(
			(e: Event) =>
				e.key.name === "up" || (e.key.name === "p" && e.key.ctrl)
		);
		const downKey = events.keypress.filter(
			(e: Event) =>
				e.key.name === "down" || (e.key.name === "n" && e.key.ctrl)
		);
		const allKey = events.keypress.filter(
			(e: Event) => e.key.name === "o" && e.key.ctrl
		);
		const validation = this.handleSubmitEvents(
			events.line.map(this.getCurrentValue.bind(this))
		);

		validation.success.forEach(this.onEnd.bind(this));
		validation.error.forEach(this.onError.bind(this));
		upKey.forEach(this.onUpKey.bind(this));
		downKey.forEach(this.onDownKey.bind(this));
		allKey.takeUntil(validation.success).forEach(this.onAllKey.bind(this));
		events.spaceKey
			.takeUntil(validation.success)
			.forEach(this.onSpaceKey.bind(this));
		events.keypress
			.filter(
				(e: Event) => !e.key.ctrl && !ignoreKeys.includes(e.key.name)
			)
			.takeUntil(validation.success)
			.forEach(this.onKeyPress.bind(this));

		this.render();
		return this;
	}
}

export = SearchBox;
