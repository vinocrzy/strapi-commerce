/**
 *
 * EditView
 *
 */

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { get, isEmpty, isEqual, omit } from 'lodash';
import { Header, Inputs as InputsIndex } from '@buffetjs/custom';
import { Play } from '@buffetjs/icons';
import {
  request,
  useGlobalContext,
  getYupInnerErrors,
  BackHeader,
  LoadingIndicatorPage,
} from 'strapi-helper-plugin';
import { useModels } from '../../../hooks';
import PageTitle from '../../../components/SettingsPageTitle';
import { Inputs, TriggerContainer } from '../../../components/Webhooks';
import reducer, { initialState } from './reducer';
import { cleanData, form, schema } from './utils';
import Wrapper from './Wrapper';

function EditView() {
  const { isLoading: isLoadingForModels, collectionTypes } = useModels();

  const isMounted = useRef();
  const { formatMessage } = useGlobalContext();
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reducerState, dispatch] = useReducer(reducer, initialState);
  const { push, replace } = useHistory();
  const {
    params: { id },
  } = useRouteMatch('/settings/webhooks/:id');

  const abortController = new AbortController();
  const { signal } = abortController;
  const isCreating = id === 'create';

  const {
    formErrors,
    modifiedData,
    initialData,
    isLoading,
    isTriggering,
    triggerResponse,
  } = reducerState.toJS();

  useEffect(() => {
    isMounted.current = true;

    const fetchData = async () => {
      try {
        const { data } = await request(`/admin/webhooks/${id}`, {
          method: 'GET',
        });

        if (isMounted.current) {
          dispatch({
            type: 'GET_DATA_SUCCEEDED',
            data,
          });
        }
      } catch (err) {
        if (isMounted.current) {
          dispatch({ type: 'UNSET_LOADER' });

          if (err.code !== 20) {
            strapi.notification.toggle({
              type: 'warning',
              message: { id: 'notification.error' },
            });
          }
        }
      }
    };

    if (!isCreating) {
      fetchData();
    } else {
      dispatch({ type: 'UNSET_LOADER' });
    }

    return () => {
      isMounted.current = false;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isCreating]);

  const areActionDisabled = isEqual(initialData, modifiedData);

  const isTriggerActionDisabled = isCreating || (!isCreating && !areActionDisabled) || isTriggering;

  const formattedErrors = Object.keys(formErrors)
    .filter(key => key.includes('headers'))
    .reduce((obj, key) => {
      obj[key] = formErrors[key];

      return obj;
    }, {});

  /* eslint-disable indent */
  const headerTitle = isCreating
    ? formatMessage({
        id: 'Settings.webhooks.create',
      })
    : initialData.name;

  const headersActions = [
    {
      color: 'primary',
      disabled: isTriggerActionDisabled,
      label: formatMessage({
        id: 'Settings.webhooks.trigger',
      }),
      onClick: () => handleTrigger(),
      title: isTriggerActionDisabled
        ? formatMessage({
            id: 'Settings.webhooks.trigger.save',
          })
        : null,
      type: 'button',
      icon: (
        <Play width="8px" height="10px" fill={isTriggerActionDisabled ? '#b4b6ba' : '#ffffff'} />
      ),
    },
    {
      color: 'cancel',
      disabled: areActionDisabled,
      label: formatMessage({
        id: 'app.components.Button.reset',
      }),
      onClick: () => handleReset(),
      style: {
        paddingLeft: '20px',
        paddingRight: '20px',
      },
      type: 'button',
    },
    {
      color: 'success',
      disabled: areActionDisabled,
      label: formatMessage({
        id: 'app.components.Button.save',
      }),
      isLoading: isSubmitting,
      style: {
        minWidth: 140,
      },
      type: 'submit',
    },
  ];
  /* eslint-enable indent */

  const headerProps = {
    title: {
      label: headerTitle,
    },
    actions: headersActions,
  };

  const checkFormErrors = async (submit = false) => {
    try {
      await schema.validate(modifiedData, { abortEarly: false });

      if (isMounted.current) {
        setErrors({});

        if (submit) {
          submitForm();
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setErrors(getYupInnerErrors(err));

        if (submit) {
          strapi.notification.toggle({
            type: 'warning',
            message: { id: 'notification.form.error.fields' },
          });
        }
      }
    }
  };

  const createWebhooks = async () => {
    try {
      strapi.lockAppWithOverlay();
      setIsSubmitting(true);
      const { data } = await request('/admin/webhooks', {
        method: 'POST',
        body: cleanData(modifiedData),
      });
      setIsSubmitting(false);
      dispatch({
        type: 'SUBMIT_SUCCEEDED',
      });
      strapi.notification.toggle({
        type: 'success',
        message: { id: 'Settings.webhooks.created' },
      });
      replace(`/settings/webhooks/${data.id}`);
    } catch (err) {
      setIsSubmitting(false);
      strapi.notification.toggle({
        type: 'warning',
        message: { id: 'notification.error' },
      });
    } finally {
      strapi.unlockApp();
    }
  };

  const getErrorMessage = error => {
    if (!error) {
      return null;
    }

    return formatMessage({
      id: error.id,
    });
  };

  const goToList = () => push('/settings/webhooks');

  const handleChange = ({ target: { name, value } }) => {
    dispatch({
      type: 'ON_CHANGE',
      keys: name.split('.'),
      value,
    });

    if (submittedOnce) {
      if (name === 'events') {
        resetEventsError();
      }
      if (name.includes('headers')) {
        resetHeadersError(name);
      }
    }
  };

  const handleClick = () => {
    dispatch({
      type: 'ADD_NEW_HEADER',
      keys: ['headers'],
    });
  };

  const handleTrigger = async () => {
    dispatch({
      type: 'SET_IS_TRIGGERING',
    });

    try {
      const { data } = await request(`/admin/webhooks/${id}/trigger`, {
        method: 'POST',
        signal,
      });

      if (isMounted.current) {
        dispatch({
          type: 'TRIGGER_SUCCEEDED',
          response: data,
        });
      }
    } catch (err) {
      if (isMounted.current) {
        if (err.code !== 20) {
          strapi.notification.toggle({
            type: 'warning',
            message: { id: 'notification.error' },
          });
        }
        dispatch({
          type: 'SET_IS_TRIGGERING',
        });
      }
    }
  };

  const handleRemove = index => {
    dispatch({
      type: 'ON_HEADER_REMOVE',
      index,
    });

    resetHeadersErrors();
  };

  const handleReset = () =>
    dispatch({
      type: 'RESET_FORM',
    });

  const handleSubmit = e => {
    e.preventDefault();
    setSubmittedOnce(true);
    checkFormErrors(true);
  };

  const onCancelTrigger = () => {
    abortController.abort();

    dispatch({
      type: 'ON_TRIGGER_CANCELED',
    });
  };

  const resetEventsError = () => {
    const errors = formErrors;
    delete errors.events;
    setErrors(errors);
  };

  const resetHeadersError = keys => {
    const errors = formErrors;

    setErrors(omit(errors, [keys]));
  };

  const resetHeadersErrors = () => {
    const errors = formErrors;
    const newErrors = Object.keys(errors)
      .filter(key => !key.includes('headers'))
      .reduce((obj, key) => {
        obj[key] = formErrors[key];

        return obj;
      }, {});

    setErrors(newErrors);
  };

  const setErrors = errors => {
    dispatch({
      type: 'SET_ERRORS',
      errors,
    });
  };

  const submitForm = () => {
    if (!isCreating) {
      updateWebhook();
    } else {
      createWebhooks();
    }
  };

  const updateWebhook = async () => {
    try {
      strapi.lockAppWithOverlay();
      setIsSubmitting(true);

      const body = cleanData(modifiedData);
      delete body.id;

      await request(`/admin/webhooks/${id}`, {
        method: 'PUT',
        body,
      });
      setIsSubmitting(false);
      dispatch({
        type: 'SUBMIT_SUCCEEDED',
      });
      strapi.notification.toggle({
        type: 'success',
        message: { id: 'notification.form.success.fields' },
      });
    } catch (err) {
      setIsSubmitting(false);
      strapi.notification.toggle({
        type: 'warning',
        message: { id: 'notification.error' },
      });
    } finally {
      strapi.unlockApp();
    }
  };

  const shouldShowDPEvents = useMemo(
    () => collectionTypes.some(ct => ct.options.draftAndPublish === true),
    [collectionTypes]
  );

  if (isLoading || isLoadingForModels) {
    return <LoadingIndicatorPage />;
  }

  return (
    <Wrapper>
      <PageTitle name="Webhooks" />
      <BackHeader onClick={goToList} />
      <form onSubmit={handleSubmit}>
        <Header {...headerProps} />
        {(isTriggering || !isEmpty(triggerResponse)) && (
          <div className="trigger-wrapper">
            <TriggerContainer
              isPending={isTriggering}
              response={triggerResponse}
              onCancel={onCancelTrigger}
            />
          </div>
        )}
        <div className="form-wrapper">
          <div className="form-card">
            <div className="row">
              {Object.keys(form).map(key => {
                return (
                  <div key={key} className={form[key].styleName}>
                    <InputsIndex
                      {...form[key]}
                      customInputs={{
                        headers: Inputs,
                        events: Inputs,
                      }}
                      label={formatMessage({
                        id: form[key].label,
                      })}
                      error={getErrorMessage(get(formErrors, key, null))}
                      name={key}
                      onChange={handleChange}
                      shouldShowDPEvents={shouldShowDPEvents}
                      validations={form[key].validations}
                      value={modifiedData[key] || form[key].value}
                      {...(form[key].type === 'headers' && {
                        onClick: handleClick,
                        onRemove: handleRemove,
                        customError: formattedErrors,
                      })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Wrapper>
  );
}

export default EditView;
