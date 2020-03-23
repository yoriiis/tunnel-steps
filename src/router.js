export default class Router {
	constructor (options) {
		const userOptions = options || {};
		const defaultOptions = {
			defaultRoute: null,
			stepsOrder: [],
			steps: {},
			getDatasFromCache: () => {}
		};

		// Merge default options with user options
		this.options = Object.assign(defaultOptions, userOptions);

		this.reverseNavigation = false;
		this.stepCreated = false;
		this.applicationReady = false;
		this.stepRedirected = {};
	}

	/**
	 * Initialize the main router of the application
	 */
	init () {
		this.addEvents();

		// Get current route
		const route = this.getRoute();

		// Declare the default route
		// If route exist, keep it, else set it to the default route
		this.currentRoute = route === '' ? this.options.defaultRoute : route;

		// Init the router with the default route
		if (route === '') {
			this.setRoute(this.currentRoute);
		} else {
			// Page started with a route, trigger hash changed
			this.hashChanged();
		}
	}

	/**
	 * Create router event listeners
	 * All listeners are created on class properties to facilitate the deletion of events
	 */
	addEvents () {
		// Create the hash changed event of all the application
		this.onHashChanged = this.hashChanged.bind(this);
		window.addEventListener('hashchange', this.onHashChanged, false);
	}

	/**
	 * Main hash changed event of the application
	 *
	 * @param {Object} e Event listener datas
	 */
	hashChanged (e) {
		// Get the current route
		const route = this.getRoute();

		// Check if the step can be displayed
		const datas = this.checkIfTheStepCanBeDisplay({
			route: route,
			event: e
		});

		this.currentRoute = route;

		// The step can be dislayed
		if (datas.canBeDisplayed) {
			this.stepCanBeDisplayed(e);
		} else {
			this.stepCantBeDisplayed(e, datas.fallbackRoute);
		}
	}

	stepCanBeDisplayed (e) {
		// Event listener exist when user click on next step button
		// Event listener doesn't exist when setRoute is called manually
		if (e) {
			// Get the previous route
			this.previousRoute = this.stepRedirected.redirect
				? this.stepRedirected.previousRoute
				: this.getPreviousRoute(e);

			// Check if previous step need to be destroyed
			// Prevent destruction when previousRoute does not exist or when user is redirected
			if (this.previousRoute) {
				// Destroy the previous step
				this.destroyStep(this.previousRoute);

				// Create the new step on destruction callback
				this.createStep({
					route: this.currentRoute
				});

				this.stepCreated = true;
			}
		}

		// If destroy method was not called, create the step now
		if (!this.stepCreated) {
			this.createStep({
				route: this.currentRoute
			});
		}

		// Reset the redirect marker
		if (this.stepRedirected.redirect) {
			this.stepRedirected.redirect = false;
		}
	}

	stepCantBeDisplayed (e, fallbackRoute) {
		// The step can't be displayed, redirect user to the previous route or the fallback route
		this.stepRedirected = {
			redirect: true,
			previousRoute: this.getPreviousRoute(e)
		};
		this.previousRoute = null;

		// If the step has a fallback route, use it
		if (fallbackRoute) {
			this.setRoute(fallbackRoute);
		}
	}

	/**
	 * Check if the step can be displayed
	 *
	 * @param {String} route Route hash
	 * @param {Object} event Event listener datas
	 *
	 * @returns {Object} Status of the render of the step
	 */
	checkIfTheStepCanBeDisplay ({ route, event }) {
		// Check the validity of the route
		if (this.options.steps[route]) {
			// Call the verification method of the step
			// The step itself knows if it can be rendered
			const datas = this.options.steps[route].canTheStepBeDisplayed();
			return datas;
		} else {
			let fallbackRoute = this.options.defaultRoute;

			// Get fallback route from previous route if exist
			const previousRoute = this.getPreviousRoute(event);
			if (previousRoute) {
				if (this.options.steps[previousRoute].fallbackRoute) {
					fallbackRoute = this.options.steps[previousRoute].fallbackRoute;
				}
			}

			// Unknown route, redirect to the fallback route
			return {
				canBeDisplayed: false,
				fallbackRoute: fallbackRoute
			};
		}
	}

	/**
	 * Create a step
	 *
	 * @param {String} route Route of the step
	 */
	createStep ({ route }) {
		// Get datas from cache before render the step
		const stepDatas = this.options.getDatasFromCache([route]);

		// Call the render method of the step
		this.options.steps[route].render({
			datas: stepDatas ? stepDatas[route].datas : null
		});

		// Prevent step created before application ready
		if (!this.applicationReady) {
			this.applicationReady = true;
		}
	}

	/**
	 * Destroy a step
	 *
	 * @param {String} route Route of the step
	 */
	destroyStep (route) {
		// Call the destroy method of the step
		this.options.steps[route].destroy();
	}

	triggerNext () {
		this.reverseNavigation = false;

		// Store the current route as the previous route because the route hasn't changed yet
		this.previousRoute = this.currentRoute;

		// Redirect to the next route or at the end
		const nextRoute = this.getNextStepRoute(this.currentRoute);
		if (nextRoute !== 'end') {
			this.setRoute(nextRoute);
			return true;
		} else {
			return false;
		}
	}

	triggerPrevious () {
		this.reverseNavigation = true;

		// Store the current route as the previous route because the route hasn't changed yet
		this.previousRoute = this.currentRoute;
		const nextRoute = this.getPreviousStepRoute(this.previousRoute);
		this.setRoute(nextRoute);
	}

	/**
	 * Get the previous route
	 *
	 * @param {Object} event Event listener datas
	 *
	 * @returns {String} returnValue Previous route
	 */
	getPreviousRoute (e) {
		return e && e.oldURL ? e.oldURL.split('#')[1] : null;
	}

	/**
	 * Get the next route from the step order array
	 * If there is no next step, the function return "end"
	 *
	 * @param {String} route Current route
	 *
	 * @returns {String} Next route or "end"
	 */
	getPreviousStepRoute (route) {
		const nextStep = this.options.steps[
			this.options.stepsOrder[this.getIndexFromRoute(route) - 1]
		];
		return nextStep ? nextStep.route : 'end';
	}

	/**
	 * Get the next route from the step order array
	 * If there is no next step, the function return "end"
	 *
	 * @param {String} route Current route
	 *
	 * @returns {String} Next route or "end"
	 */
	getNextStepRoute (route) {
		const nextStep = this.options.steps[
			this.options.stepsOrder[this.getIndexFromRoute(route) + 1]
		];
		return nextStep ? nextStep.route : 'end';
	}

	/**
	 * Get index of the route from the step order array
	 *
	 * @returns {Integer} Index of the route
	 */
	getIndexFromRoute (route) {
		return this.options.stepsOrder.findIndex(currentRoute => {
			return currentRoute === route;
		});
	}

	/**
	 * Get the current route
	 *
	 * @returns {Array} Current route
	 */
	getRoute () {
		return window.location.hash.substr(1);
	}

	/**
	 * Set the route
	 *
	 * @returns {String} route New value for the route
	 */
	setRoute (route) {
		window.location.hash = route;
	}

	/**
	 * Destroy the router (event listeners)
	 */
	destroy () {
		window.removeEventListener('hashchange', this.onHashChanged);
	}
}
