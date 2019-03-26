/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import PropTypes from 'prop-types';
import { connectAdvanced } from 'react-redux';
import { compose, mapProps } from 'recompose';
import isEqual from 'react-fast-compare';
import { getResolvedArgs, getSelectedPage } from '../../state/selectors/workpad';
import { getState, getValue, getError } from '../../lib/resolved_arg';
import { ElementWrapper as Component } from './element_wrapper';
import { createHandlers as createHandlersWithDispatch } from './lib/handlers';

function selectorFactory(dispatch) {
  let result = {};
  const createHandlers = createHandlersWithDispatch(dispatch);

  return (nextState, nextOwnProps) => {
    const { element, ...restOwnProps } = nextOwnProps;
    const { transformMatrix, width, height } = element;

    const resolvedArg = getResolvedArgs(nextState, element.id, 'expressionRenderable');
    const selectedPage = getSelectedPage(nextState);

    // build interim props object
    const nextResult = {
      ...restOwnProps,
      // state and state-derived props
      selectedPage,
      state: getState(resolvedArg),
      error: getError(resolvedArg),
      renderable: getValue(resolvedArg),
      // pass along the handlers creation function
      createHandlers,
      // required parts of the element object
      transformMatrix,
      width,
      height,
      // pass along only the useful parts of the element object
      element: {
        id: element.id,
        filter: element.filter,
        expression: element.expression,
      },
    };

    // update props only if something actually changed
    if (!isEqual(result, nextResult)) {
      result = nextResult;
    }

    return result;
  };
}

export const ElementWrapper = compose(
  connectAdvanced(selectorFactory),
  mapProps(props => {
    // create handlers object
    const { element, createHandlers, ...restProps } = props;
    const handlers = createHandlers(element, props.selectedPage);
    // this removes element and createHandlers from passed props
    return { ...restProps, handlers };
  })
)(Component);

ElementWrapper.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    transformMatrix: PropTypes.arrayOf(PropTypes.number).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    // sometimes we get a shape, which lacks an expression
    // so element properties can not be marked as required
    expression: PropTypes.string,
    filter: PropTypes.string,
  }).isRequired,
};
