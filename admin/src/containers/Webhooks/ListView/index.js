/**
 *
 * ListView
 *
 */

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Header, List } from '@buffetjs/custom';
import { Button } from '@buffetjs/core';
import { Plus } from '@buffetjs/icons';
import { omit } from 'lodash';
import { useIntl } from 'react-intl';
import {
  request,
  ListButton,
  PopUpWarning,
  useUserPermissions,
  LoadingIndicatorPage,
  EmptyState,
} from 'strapi-helper-plugin';
import adminPermissions from '../../../permissions';
import PageTitle from '../../../components/SettingsPageTitle';
import { ListRow } from '../../../components/Webhooks';
import Wrapper from './Wrapper';
import reducer, { initialState } from './reducer';

function ListView() {
  const {
    isLoading,
    allowedActions: { canCreate, canRead, canUpdate, canDelete },
  } = useUserPermissions(adminPermissions.settings.webhooks);

  const isMounted = useRef(true);
  const { formatMessage } = useIntl();
  const [showModal, setShowModal] = useState(false);
  const [reducerState, dispatch] = useReducer(reducer, initialState);
  const { push } = useHistory();
  const { pathname } = useLocation();

  const { webhooks, webhooksToDelete, webhookToDelete } = reducerState.toJS();

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (canRead) {
      fetchData();
    }
  }, [canRead]);

  const getWebhookIndex = id => webhooks.findIndex(webhook => webhook.id === id);

  // New button
  const addBtnLabel = formatMessage({
    id: 'Settings.webhooks.list.button.add',
  });

  const newButtonProps = {
    label: addBtnLabel,
    onClick: () => handleGoTo('create'),
    color: 'primary',
    type: 'button',
    icon: <Plus fill="#007eff" width="11px" height="11px" />,
    Component: props => {
      if (canCreate) {
        return <Button {...props} />;
      }

      return null;
    },
  };

  // Header props
  const actions = [
    {
      ...newButtonProps,
      icon: true,
      style: {
        paddingLeft: 15,
        paddingRight: 15,
      },
    },
  ];

  const headerProps = {
    title: {
      label: formatMessage({ id: 'Settings.webhooks.title' }),
    },
    content: formatMessage({ id: 'Settings.webhooks.list.description' }),
    actions,
  };

  // List props
  const rowsCount = webhooks.length;
  const titleLabel = `${
    rowsCount > 1
      ? formatMessage({ id: 'Settings.webhooks.title' })
      : formatMessage({ id: 'Settings.webhooks.singular' })
  }`;
  const title = `${rowsCount} ${titleLabel}`;

  /* eslint-disable indent */
  const deleteButtonProps = canDelete
    ? {
        color: 'delete',
        disabled: !(webhooksToDelete.length > 0),
        label: formatMessage({ id: 'app.utils.delete' }),
        onClick: () => setShowModal(true),
        type: 'button',
      }
    : null;
  /* eslint-enable indent */

  const listProps = {
    title,
    button: deleteButtonProps,
    items: webhooks,
  };

  const fetchData = async () => {
    try {
      const { data } = await request('/admin/webhooks', {
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
        if (err.code !== 20) {
          strapi.notification.toggle({
            type: 'warning',
            message: { id: 'notification.error' },
          });
        }
      }
    }
  };

  const handleChange = (value, id) => {
    dispatch({
      type: 'SET_WEBHOOKS_TO_DELETE',
      value,
      id,
    });
  };

  const handleConfirmDelete = () => {
    if (webhookToDelete) {
      handleConfirmDeleteOne();
    } else {
      handleConfirmDeleteAll();
    }
  };

  const handleConfirmDeleteOne = async () => {
    try {
      await request(`/admin/webhooks/${webhookToDelete}`, {
        method: 'DELETE',
      });

      dispatch({
        type: 'WEBHOOK_DELETED',
        index: getWebhookIndex(webhookToDelete),
      });
    } catch (err) {
      if (err.code !== 20) {
        strapi.notification.toggle({
          type: 'warning',
          message: { id: 'notification.error' },
        });
      }
    }
    setShowModal(false);
  };

  const handleConfirmDeleteAll = async () => {
    const body = {
      ids: webhooksToDelete,
    };

    try {
      await request('/admin/webhooks/batch-delete', {
        method: 'POST',
        body,
      });

      if (isMounted.current) {
        dispatch({
          type: 'WEBHOOKS_DELETED',
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
      }
    }
    setShowModal(false);
  };

  const handleDeleteClick = id => {
    setShowModal(true);

    dispatch({
      type: 'SET_WEBHOOK_TO_DELETE',
      id,
    });
  };

  const handleEnabledChange = async (value, id) => {
    const webhookIndex = getWebhookIndex(id);

    const initialWebhookProps = webhooks[webhookIndex];
    const keys = [webhookIndex, 'isEnabled'];

    const body = {
      ...initialWebhookProps,
      isEnabled: value,
    };

    delete body.id;

    try {
      dispatch({
        type: 'SET_WEBHOOK_ENABLED',
        keys,
        value,
      });

      await request(`/admin/webhooks/${id}`, {
        method: 'PUT',
        body,
      });
    } catch (err) {
      if (isMounted.current) {
        dispatch({
          type: 'SET_WEBHOOK_ENABLED',
          keys,
          value: !value,
        });

        if (err.code !== 20) {
          strapi.notification.toggle({
            type: 'warning',
            message: { id: 'notification.error' },
          });
        }
      }
    }
  };

  const handleGoTo = to => {
    push(`${pathname}/${to}`);
  };

  if (isLoading) {
    return <LoadingIndicatorPage />;
  }

  return (
    <Wrapper>
      <PageTitle name="Webhooks" />
      <Header {...headerProps} />
      {canRead && (
        <div className="list-wrapper">
          {rowsCount > 0 ? (
            <List
              {...listProps}
              customRowComponent={props => {
                return (
                  <ListRow
                    {...props}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    onCheckChange={handleChange}
                    onEditClick={handleGoTo}
                    onDeleteCLick={handleDeleteClick}
                    onEnabledChange={handleEnabledChange}
                    itemsToDelete={webhooksToDelete}
                  />
                );
              }}
            />
          ) : (
            <EmptyState
              title={formatMessage({ id: 'Settings.webhooks.list.empty.title' })}
              description={formatMessage({ id: 'Settings.webhooks.list.empty.description' })}
              link="https://strapi.io/documentation/developer-docs/latest/concepts/webhooks.html"
              linkText={formatMessage({ id: 'Settings.webhooks.list.empty.link' })}
            />
          )}
          <ListButton>{canCreate && <Button {...omit(newButtonProps, 'Component')} />}</ListButton>
        </div>
      )}
      <PopUpWarning
        isOpen={showModal}
        toggleModal={() => setShowModal(!showModal)}
        popUpWarningType="danger"
        onConfirm={handleConfirmDelete}
      />
    </Wrapper>
  );
}

export default ListView;
