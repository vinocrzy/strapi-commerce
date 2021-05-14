import React, { useReducer } from "react";
import { Table } from "@buffetjs/core";
import { sortBy as sort } from "lodash";

const headers = [
  {
    name: "Id",
    value: "id",
    isSortEnabled: true,
  },
  {
    name: "Customer name",
    value: "userName",
    isSortEnabled: true,
  },
  {
    name: "Customer Mail",
    value: "userEmail",
    isSortEnabled: true,
  },
  {
    name: "Customer Phone",
    value: "userPhone",
    isSortEnabled: true,
  },
  {
    name: "Status",
    value: "status",
    isSortEnabled: true,
  },
];

const updateAtIndex = (array, index, value) =>
  array.map((row, i) => {
    if (index === i) {
      row._isChecked = value;
    }

    return row;
  });

const updateRows = (array, shouldSelect) =>
  array.map((row) => {
    row._isChecked = shouldSelect;

    return row;
  });

function reducer(state, action) {
  const { nextElement, sortBy, type } = action;

  switch (type) {
    case "CHANGE_SORT":
      if (state.sortBy === sortBy && state.sortOrder === "asc") {
        return { ...state, sortOrder: "desc" };
      }

      if (state.sortBy !== sortBy) {
        return { ...state, sortOrder: "asc", sortBy };
      }

      if (state.sortBy === sortBy && state.sortOrder === "desc") {
        return { ...state, sortOrder: "asc", sortBy: nextElement };
      }

      return state;
    case "SELECT_ALL":
      return { ...state, rows: updateRows(state.rows, true) };
    case "SELECT_ROW":
      return {
        ...state,
        rows: updateAtIndex(state.rows, action.index, !action.row._isChecked),
      };
    case "UNSELECT_ALL":
      return { ...state, rows: updateRows(state.rows, false) };
    default:
      return state;
  }
}

function init(initialState) {
  console.log(initialState);

  const updatedRows = initialState.rows.map((row) => {
    row._isChecked = false;

    return row;
  });

  return { ...initialState, rows: updatedRows };
}

export default function OrderTable({ orders }) {
  const orderRows = [
    {
      id: 1,
      userName: "Pierre",
      userEmail: "Gagnaire",
      userPhone: "Ratatouille",
      status: "Le Gaya",
    },
  ];

  //   console.log({ orders, orderRows });

  const [state, dispatch] = useReducer(
    reducer,
    {
      headers,
      rows: orders,
      sortBy: "id",
      sortOrder: "asc",
    },
    init
  );
  const areAllEntriesSelected = state.rows.every(
    (row) => row._isChecked === true
  );
  const bulkActionProps = {
    icon: "trash",
    onConfirm: () => {
      alert("Are you sure you want to delete these entries?");
    },
    translatedNumberOfEntry: "entry",
    translatedNumberOfEntries: "entries",
    translatedAction: "Delete all",
  };
  const sortedRowsBy = sort(state.rows, [state.sortBy]);
  const sortedRows =
    state.sortOrder === "asc" ? sortedRowsBy : sortedRowsBy.reverse();

  return (
    <Table
      headers={state.headers}
      bulkActionProps={bulkActionProps}
      onClickRow={(e, data) => {
        console.log(data);
        alert("You have just clicked");
      }}
      onChangeSort={({
        sortBy,
        firstElementThatCanBeSorted,
        isSortEnabled,
      }) => {
        if (isSortEnabled) {
          dispatch({
            type: "CHANGE_SORT",
            sortBy,
            nextElement: firstElementThatCanBeSorted,
          });
        }
      }}
      onSelect={(row, index) => {
        dispatch({ type: "SELECT_ROW", row, index });
      }}
      onSelectAll={() => {
        const type = areAllEntriesSelected ? "UNSELECT_ALL" : "SELECT_ALL";

        dispatch({ type });
      }}
      rows={sortedRows}
      showActionCollapse
      sortBy={state.sortBy}
      sortOrder={state.sortOrder}
      withBulkAction
      rowLinks={[]}
    />
  );
}
