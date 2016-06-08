
import h from 'snabbdom/h';
import Vnode from 'snabbdom/vnode';
import log from './log';

let componentsToRender = [];
let newComponents = [];
let rendering = false;
let nextRender;

const Render = { patch: undefined };
export default Render;


export function renderApp(app, appElm) {
  logBeginRender();

  const el = document.createElement('div');
  const emptyVnode = Vnode('div', { key: '_init' }, [], undefined, el);
  const appNode = Render.patch(emptyVnode, app);

  newComponents.forEach(c => c.lifecycle.inserted(c));

  appElm.appendChild(appNode.elm);

  logEndRender();
}

export function renderComponentAsync(component) {
  if (rendering) {
    console.warn('A component tried to re-render while a rendering was already ongoing', component.elm);
    return;
  }

  // This component is already scheduled for the next redraw.
  // For instance, this can easily happen while the app's tab is inactive.
  // Avoids doing more work than necessary when re-activating it.
  if (componentsToRender.indexOf(component) !== -1) return;

  componentsToRender.push(component);

  if (!nextRender)
    nextRender = requestAnimationFrame(renderNow);
};

export function renderComponentSync(component) {
  renderComponent(component, true);
};

function renderComponent(component, checkRenderQueue) {
  const { props, state, elm, render, vnode, destroyed } = component;

  // Bail if the component is already destroyed.
  // This can happen if the parent renders first and decide a child component should be removed.
  if (destroyed) return;

  // The component is going to be rendered later as part of the normal
  // render process, do not force-render it now.
  if (checkRenderQueue && componentsToRender.indexOf(component) !== -1) return;

  const isNew = vnode === undefined;
  const { patch } = Render;

  let beforeRender;

  if (log.render) beforeRender = performance.now();
  const newVnode = render(props, state);

  patch(vnode || Vnode('div', { key: '_init' }, [], undefined, elm), newVnode);

  if (log.render) {
    const renderTime = Math.round((performance.now() - beforeRender) * 100) / 100;
    console.log(`Render component %c${component.key}`, 'font-weight: bold', renderTime + ' ms', component);
  }

  component.lifecycle.rendered(component, newVnode);
  if (isNew) newComponents.push(component);
}

function renderNow() {
  rendering = true;

  nextRender = undefined;
  newComponents = [];

  logBeginRender();

  // Render components in a top-down fashion.
  // This ensures the rendering order is predictive and props & states are consistent.
  componentsToRender.sort((compA, compB) => compA.depth - compB.depth);
  componentsToRender.forEach(c => renderComponent(c, false));

  rendering = false;
  componentsToRender = [];

  newComponents.forEach(c => c.lifecycle.inserted(c));

  logEndRender();
}

function logBeginRender() {
  if (log.render) console.log('%cRender - begin', 'color: orange');
}

function logEndRender() {
  if (log.render) console.log('%cRender - end\n\n', 'color: orange');
}
