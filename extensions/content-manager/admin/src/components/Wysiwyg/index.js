/**
 *
 * Wysiwyg
 *
 */
import React from 'react';
import {
  ContentState,
  EditorState,
  getDefaultKeyBinding,
  genKey,
  Modifier,
  RichUtils,
  SelectionState,
} from 'draft-js';
import PropTypes from 'prop-types';
import { isEmpty, isNaN, replace, words } from 'lodash';
import cn from 'classnames';
import WysiwygProvider from '../../containers/WysiwygProvider';
import Controls from '../WysiwygInlineControls';
import PreviewWysiwyg from '../PreviewWysiwyg';
import WysiwygBottomControls from '../WysiwygBottomControls';
import WysiwygEditor from '../WysiwygEditor';
import MediaLib from './MediaLib';
import CustomSelect from './customSelect';
import PreviewControl from './previewControl';
import ToggleMode from './toggleMode';
import { CONTROLS } from './constants';
import {
  getBlockContent,
  getBlockStyle,
  getDefaultSelectionOffsets,
  getKeyCommandData,
  getOffSets,
} from './helpers';
import {
  createNewBlock,
  getNextBlocksList,
  getSelectedBlocksList,
  onTab,
  updateSelection,
} from './utils';
import EditorWrapper from './EditorWrapper';

/* eslint-disable */

class Wysiwyg extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: EditorState.createEmpty(),
      isFocused: false,
      isFullscreen: false,
      isMediaLibraryOpened: false,
      isPreviewMode: false,
      headerValue: '',
      selection: null,
    };
    this.focus = () => {
      this.setState({ isFocused: true });

      return this.domEditor.focus();
    };
    this.blur = () => {
      this.setState({ isFocused: false });

      return this.domEditor.blur();
    };
  }

  componentDidMount() {
    if (this.props.autoFocus) {
      this.focus();
    }

    if (!isEmpty(this.props.value)) {
      this.setInitialValue(this.props);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.value !== this.props.value && !this.state.isFocused) {
      return true;
    }

    if (nextState.editorState !== this.state.editorState) {
      return true;
    }

    if (nextProps.resetProps !== this.props.resetProps) {
      return true;
    }

    if (nextState.isFocused !== this.state.isFocused) {
      return true;
    }

    if (nextState.isFullscreen !== this.state.isFullscreen) {
      return true;
    }

    if (nextState.isPreviewMode !== this.state.isPreviewMode) {
      return true;
    }

    if (nextState.headerValue !== this.state.headerValue) {
      return true;
    }

    if (nextProps.error !== this.props.error) {
      return true;
    }

    if (nextState.isMediaLibraryOpened !== this.state.isMediaLibraryOpened) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps) {
    // Handle resetProps
    if (prevProps.resetProps !== this.props.resetProps) {
      this.setInitialValue(this.props);
    }

    // Update the content when used in a dynamiczone
    // We cannot update the value of the component each time there is a onChange event
    // fired otherwise the component gets very slow
    if (prevProps.value !== this.props.value && !this.state.isFocused) {
      this.setInitialValue(this.props);
    }

    // Here we need to update the content of editorState for the edition case
    // With the current architecture of the EditView we cannot rely on the componentDidMount lifecycle
    // Since we need to perform some operations in the reducer the loading phase stops before all the operations
    // are computed which in some case causes the inputs component to be initialised with a null value.
    if (!prevProps.value && this.props.value) {
      // This is also called if the first thing you add in the editor is
      // a markdown formatting block (b, i, u, etc.) which results in
      // the selection being pushed to the end after the first character is added.
      // Basically, setInitialValue is always called whenever
      // you start typing in an empty editor (even after the initial load)
      this.setInitialValue(this.props);
    }
  }

  /**
   * Init the editor with data from
   * @param {[type]} props [description]
   */
  setInitialValue = props => {
    if (isEmpty(props.value)) {
      return this.setState({ editorState: EditorState.createEmpty() });
    }

    const contentState = ContentState.createFromText(props.value);
    const newEditorState = EditorState.createWithContent(contentState);
    const editorState = this.state.isFocused
      ? EditorState.moveFocusToEnd(newEditorState)
      : newEditorState;

    return this.setState({ editorState });
  };

  /**
   * Handler to add B, I, Strike, U, link
   * @param {String} content usually something like **textToReplace**
   * @param {String} style
   */
  addContent = (content, style) => {
    const selectedText = this.getSelectedText();
    // Retrieve the associated data for the type to add
    const { innerContent, endReplacer, startReplacer } = getBlockContent(style);
    // Replace the selected text by the markdown command or insert default text
    const defaultContent =
      selectedText === ''
        ? replace(content, 'textToReplace', innerContent)
        : replace(content, 'textToReplace', selectedText);
    // Get the current cursor position
    const cursorPosition = getOffSets(this.getSelection()).start;
    const textWithEntity = this.modifyBlockContent(defaultContent);
    // Highlight the text
    const { anchorOffset, focusOffset } = getDefaultSelectionOffsets(
      defaultContent,
      startReplacer,
      endReplacer,
      cursorPosition
    );
    // Merge the current selection with the new one
    const updatedSelection = this.getSelection().merge({
      anchorOffset,
      focusOffset,
    });
    const newEditorState = EditorState.push(
      this.getEditorState(),
      textWithEntity,
      'insert-character'
    );

    if (selectedText.length === 0) {
      this.setState(
        {
          // Highlight the text if the selection was empty
          editorState: EditorState.forceSelection(newEditorState, updatedSelection),
        },
        () => {
          this.focus();
          // Update the parent reducer
        }
      );
      this.sendData(newEditorState);
      return;
    }

    // Don't handle selection: the user has selected some text to be changed with the appropriate markdown
    this.setState(
      {
        editorState: newEditorState,
      },
      () => {
        this.focus();
      }
    );
    this.sendData(newEditorState);
    return;
  };

  /**
   * Create an ordered list block
   * @return ContentBlock
   */
  addOlBlock = () => {
    // Get all the selected blocks
    const selectedBlocksList = getSelectedBlocksList(this.getEditorState());
    let newEditorState = this.getEditorState();

    // Check if the cursor is NOT at the beginning of a new line
    // So we need to move all the next blocks
    if (getOffSets(this.getSelection()).start !== 0) {
      // Retrieve all the blocks after the current position
      const nextBlocks = getNextBlocksList(newEditorState, this.getSelection().getStartKey());
      let liNumber = 1;

      // Loop to update each block after the inserted li
      nextBlocks.map((block, index) => {
        const previousContent =
          index === 0
            ? this.getEditorState()
                .getCurrentContent()
                .getBlockForKey(this.getCurrentAnchorKey())
            : newEditorState.getCurrentContent().getBlockBefore(block.getKey());
        // Check if there was an li before the position so we update the entire list bullets
        const number = previousContent ? parseInt(previousContent.getText().split('.')[0], 10) : 0;
        liNumber = isNaN(number) ? 1 : number + 1;
        const nextBlockText = index === 0 ? `${liNumber}. ` : nextBlocks.get(index - 1).getText();
        // Update the current block
        const newBlock = createNewBlock(nextBlockText, 'block-list', block.getKey());
        // Update the contentState
        const newContentState = this.createNewContentStateFromBlock(
          newBlock,
          newEditorState.getCurrentContent()
        );
        newEditorState = EditorState.push(newEditorState, newContentState);
      });

      // Move the cursor to the correct position and add a space after '.'
      // 2 for the dot and the space after, we add the number length (10 = offset of 2)
      const offset = 2 + liNumber.toString().length;
      const updatedSelection = updateSelection(this.getSelection(), nextBlocks, offset);

      return this.setState({
        editorState: EditorState.acceptSelection(newEditorState, updatedSelection),
      });
    }

    // If the cursor is at the beginning we need to move all the content after the cursor so we don't loose the data
    selectedBlocksList.map((block, i) => {
      const selectedText = block.getText();
      const li = selectedText === '' ? `${i + 1}. ` : `${i + 1}. ${selectedText}`;
      const newBlock = createNewBlock(li, 'block-list', block.getKey());
      const newContentState = this.createNewContentStateFromBlock(
        newBlock,
        newEditorState.getCurrentContent()
      );
      newEditorState = EditorState.push(newEditorState, newContentState);
    });

    // Update the parent reducer
    this.sendData(newEditorState);

    return this.setState({
      editorState: EditorState.moveFocusToEnd(newEditorState),
    });
  };

  /**
   * Create an unordered list
   * @return ContentBlock
   */
  // NOTE: it's pretty much the same dynamic as above
  // We don't use the same handler because it needs less logic than a ordered list
  // so it's easier to maintain the code
  addUlBlock = () => {
    const selectedBlocksList = getSelectedBlocksList(this.getEditorState());
    let newEditorState = this.getEditorState();

    if (getOffSets(this.getSelection()).start !== 0) {
      const nextBlocks = getNextBlocksList(newEditorState, this.getSelection().getStartKey());

      nextBlocks.map((block, index) => {
        const nextBlockText = index === 0 ? '- ' : nextBlocks.get(index - 1).getText();
        const newBlock = createNewBlock(nextBlockText, 'block-list', block.getKey());
        const newContentState = this.createNewContentStateFromBlock(
          newBlock,
          newEditorState.getCurrentContent()
        );
        newEditorState = EditorState.push(newEditorState, newContentState);
      });

      const updatedSelection = updateSelection(this.getSelection(), nextBlocks, 2);

      return this.setState({
        editorState: EditorState.acceptSelection(newEditorState, updatedSelection),
      });
    }

    selectedBlocksList.map(block => {
      const selectedText = block.getText();
      const li = selectedText === '' ? '- ' : `- ${selectedText}`;
      const newBlock = createNewBlock(li, 'block-list', block.getKey());
      const newContentState = this.createNewContentStateFromBlock(
        newBlock,
        newEditorState.getCurrentContent()
      );
      newEditorState = EditorState.push(newEditorState, newContentState);
    });
    this.sendData(newEditorState);
    return this.setState({
      editorState: EditorState.moveFocusToEnd(newEditorState),
    });
  };

  /**
   * Handler to create header
   * @param {String} text header content
   */
  addBlock = text => {
    const nextBlockKey = this.getNextBlockKey(this.getCurrentAnchorKey()) || genKey();
    const newBlock = createNewBlock(text, 'header', nextBlockKey);
    const newContentState = this.createNewContentStateFromBlock(newBlock);
    const newEditorState = this.createNewEditorState(newContentState, text);

    this.sendData(newEditorState);

    return this.setState(
      {
        editorState: newEditorState,
      },
      () => {
        this.focus();
      }
    );
  };

  addLinks = data => {
    const links = data.reduce((acc, { alt, url }) => `${acc}![${alt}](${url})\n`, '');
    const { selection } = this.state;
    const newBlock = createNewBlock(links);
    const newContentState = this.createNewContentStateFromBlock(newBlock);
    const anchorOffset = links.length;
    const focusOffset = links.length;
    let newEditorState = this.createNewEditorState(newContentState, links);

    const updatedSelection =
      getOffSets(selection).start === 0
        ? this.getSelection().merge({ anchorOffset, focusOffset })
        : new SelectionState({
            anchorKey: newBlock.getKey(),
            anchorOffset,
            focusOffset,
            focusKey: newBlock.getKey(),
            isBackward: false,
          });

    newEditorState = EditorState.forceSelection(newEditorState, updatedSelection);

    this.setState({ isFocused: true });
    this.sendData(newEditorState);

    return this.setState({
      editorState: newEditorState,
    });
  };

  /**
   * Handler used for code block and Img controls
   * @param {String} content the text that will be added
   * @param {String} style   the type
   */
  addSimpleBlockWithSelection = (content, style) => {
    // Retrieve the selected text by the user
    const selectedText = this.getSelectedText();
    const { innerContent, endReplacer, startReplacer } = getBlockContent(style);
    const defaultContent =
      selectedText === ''
        ? replace(content, 'textToReplace', innerContent)
        : replace(content, 'textToReplace', selectedText);
    const newBlock = createNewBlock(defaultContent);
    const newContentState = this.createNewContentStateFromBlock(newBlock);
    const { anchorOffset, focusOffset } = getDefaultSelectionOffsets(
      defaultContent,
      startReplacer,
      endReplacer
    );

    let newEditorState = this.createNewEditorState(newContentState, defaultContent);
    const updatedSelection =
      getOffSets(this.getSelection()).start === 0
        ? this.getSelection().merge({ anchorOffset, focusOffset })
        : new SelectionState({
            anchorKey: newBlock.getKey(),
            anchorOffset,
            focusOffset,
            focusKey: newBlock.getKey(),
            isBackward: false,
          });

    newEditorState = EditorState.acceptSelection(newEditorState, updatedSelection);

    return this.setState(
      {
        editorState: EditorState.forceSelection(newEditorState, newEditorState.getSelection()),
      },
      () => {
        this.focus();
        // Update the parent reducer
        this.sendData(newEditorState);
      }
    );
  };

  /**
   * Update the current editorState
   * @param  {Map} newContentState
   * @param  {String} text            The text to add
   * @return {Map}                 EditorState
   */
  createNewEditorState = (newContentState, text) => {
    let newEditorState;

    if (getOffSets(this.getSelection()).start !== 0) {
      newEditorState = EditorState.push(this.getEditorState(), newContentState);
    } else {
      const textWithEntity = this.modifyBlockContent(text);
      newEditorState = EditorState.push(this.getEditorState(), textWithEntity, 'insert-characters');
    }
    return newEditorState;
  };

  /**
   * Update the content of a block
   * @param  {Map} newBlock     The new block
   * @param  {Map} contentState The ContentState
   * @return {Map}              The updated block
   */
  createNewBlockMap = (newBlock, contentState) =>
    contentState.getBlockMap().set(newBlock.key, newBlock);

  createNewContentStateFromBlock = (
    newBlock,
    contentState = this.getEditorState().getCurrentContent()
  ) =>
    ContentState.createFromBlockArray(this.createNewBlockMap(newBlock, contentState).toArray())
      .set('selectionBefore', contentState.getSelectionBefore())
      .set('selectionAfter', contentState.getSelectionAfter());

  getCharactersNumber = (editorState = this.getEditorState()) => {
    const plainText = editorState.getCurrentContent().getPlainText();
    const spacesNumber = plainText.split(' ').length;

    return words(plainText).join('').length + spacesNumber - 1;
  };

  getEditorState = () => this.state.editorState;

  /**
   * Retrieve the selected text
   * @return {Map}
   */
  getSelection = () => this.getEditorState().getSelection();

  /**
   * Retrieve the cursor anchor key
   * @return {String}
   */
  getCurrentAnchorKey = () => this.getSelection().getAnchorKey();

  /**
   * Retrieve the current content block
   * @return {Map} ContentBlock
   */
  getCurrentContentBlock = () =>
    this.getEditorState()
      .getCurrentContent()
      .getBlockForKey(this.getSelection().getAnchorKey());

  /**
   * Retrieve the block key after a specific one
   * @param  {String} currentBlockKey
   * @param  {Map} [editorState=this.getEditorState()]  The current EditorState or the updated one
   * @return {String}                                    The next block key
   */
  getNextBlockKey = (currentBlockKey, editorState = this.getEditorState()) =>
    editorState.getCurrentContent().getKeyAfter(currentBlockKey);

  getSelectedText = ({ start, end } = getOffSets(this.getSelection())) =>
    this.getCurrentContentBlock()
      .getText()
      .slice(start, end);

  handleBlur = () => {
    const target = {
      name: this.props.name,
      type: 'textarea',
      value: this.getEditorState()
        .getCurrentContent()
        .getPlainText(),
    };
    this.props.onBlur({ target });
    this.blur();
  };

  handleChangeSelect = ({ target }) => {
    this.setState({ headerValue: target.value });
    const selectedText = this.getSelectedText();
    const title = selectedText === '' ? `${target.value} ` : `${target.value} ${selectedText}`;
    this.addBlock(title);

    return this.setState({ headerValue: '' });
  };

  handleClickPreview = () => this.setState({ isPreviewMode: !this.state.isPreviewMode });

  /**
   * Handler that listens for specific key commands
   * @param  {String} command
   * @param  {Map} editorState
   * @return {Bool}
   */
  handleKeyCommand = (command, editorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);

    if (command === 'bold' || command === 'italic' || command === 'underline') {
      const { content, style } = getKeyCommandData(command);
      this.addContent(content, style);
      return false;
    }

    if (newState && command !== 'backspace') {
      this.onChange(newState);
      return true;
    }

    return false;
  };

  handleOpenMediaLibrary = () => {
    return this.setState({
      isMediaLibraryOpened: true,
      isFullscreen: false,
      selection: this.getSelection(),
    });
  };

  handleReturn = (e, editorState) => {
    const selection = editorState.getSelection();
    const currentBlock = editorState.getCurrentContent().getBlockForKey(selection.getStartKey());

    if (currentBlock.getText().split('')[0] === '-') {
      this.addUlBlock();
      return true;
    }

    if (
      currentBlock.getText().split('.').length > 1 &&
      !isNaN(parseInt(currentBlock.getText().split('.')[0], 10))
    ) {
      this.addOlBlock();
      return true;
    }

    return false;
  };

  mapKeyToEditorCommand = e => {
    if (e.keyCode === 9 /* TAB */) {
      const newEditorState = RichUtils.onTab(e, this.state.editorState, 4 /* maxDepth */);
      if (newEditorState !== this.state.editorState) {
        this.onChange(newEditorState);
      }
      return;
    }

    return getDefaultKeyBinding(e);
  };

  /**
   * Change the content of a block
   * @param  {String]} text
   * @param  {Map} [contentState=this.getEditorState().getCurrentContent()]
   * @return {Map}
   */
  modifyBlockContent = (text, contentState = this.getEditorState().getCurrentContent()) =>
    Modifier.replaceText(contentState, this.getSelection(), text);

  onChange = editorState => {
    const { disabled } = this.props;

    if (!disabled) {
      this.sendData(editorState);
      this.setState({ editorState });
    }
  };

  handleTab = e => {
    e.preventDefault();
    const newEditorState = onTab(this.getEditorState());

    return this.onChange(newEditorState);
  };

  /**
   * Toggle the medialibrary modal
   */

  handleToggle = () => {
    this.setState(prevState => ({
      ...prevState,
      isMediaLibraryOpened: !prevState.isMediaLibraryOpened,
    }));
  };

  /**
   * Update the parent reducer
   * @param  {Map} editorState [description]
   */
  sendData = editorState => {
    if (
      this.getEditorState().getCurrentContent() !== editorState.getCurrentContent() ||
      editorState.getLastChangeType() === 'remove-range'
    ) {
      this.props.onChange({
        target: {
          value: editorState.getCurrentContent().getPlainText(),
          name: this.props.name,
          type: 'textarea',
        },
      });
    } else return;
  };

  toggleFullScreen = e => {
    e.preventDefault();
    this.setState({
      isFullscreen: !this.state.isFullscreen,
      isPreviewMode: false,
    });
  };

  render() {
    const { editorState, isMediaLibraryOpened, isPreviewMode, isFullscreen } = this.state;
    const editorStyle = isFullscreen ? { marginTop: '0' } : this.props.style;
    const { disabled } = this.props;

    return (
      <WysiwygProvider
        handleChangeSelect={this.handleChangeSelect}
        headerValue={this.state.headerValue}
        html={this.props.value}
        isPreviewMode={this.state.isPreviewMode}
        isFullscreen={this.state.isFullscreen}
        placeholder={this.props.placeholder}
      >
        <EditorWrapper isFullscreen={isFullscreen} disabled={disabled}>
          {/* FIRST EDITOR WITH CONTROLS} */}
          <div
            className={cn(
              'editorWrapper',
              !this.props.deactivateErrorHighlight && this.props.error && 'editorError',
              !isEmpty(this.props.className) && this.props.className
            )}
            onClick={e => {
              if (isFullscreen) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            style={editorStyle}
          >
            <div className="controlsContainer">
              <CustomSelect disabled={isPreviewMode || disabled} />
              {CONTROLS.map((value, key) => (
                <Controls
                  key={key}
                  buttons={value}
                  disabled={isPreviewMode || disabled}
                  editorState={editorState}
                  handlers={{
                    addContent: this.addContent,
                    addOlBlock: this.addOlBlock,
                    addSimpleBlockWithSelection: this.addSimpleBlockWithSelection,
                    addUlBlock: this.addUlBlock,
                    handleOpenMediaLibrary: this.handleOpenMediaLibrary,
                  }}
                  onToggle={this.toggleInlineStyle}
                  onToggleBlock={this.toggleBlockType}
                />
              ))}
              {!isFullscreen ? (
                <ToggleMode isPreviewMode={isPreviewMode} onClick={this.handleClickPreview} />
              ) : (
                <div style={{ marginRight: '10px' }} />
              )}
            </div>
            {/* WYSIWYG PREVIEW NOT FULLSCREEN */}
            {isPreviewMode ? (
              <PreviewWysiwyg data={this.props.value} />
            ) : (
              <div
                className={cn('editor', isFullscreen && 'editorFullScreen')}
                onClick={this.focus}
              >
                <WysiwygEditor
                  blockStyleFn={getBlockStyle}
                  editorState={editorState}
                  handleKeyCommand={this.handleKeyCommand}
                  handleReturn={this.handleReturn}
                  keyBindingFn={this.mapKeyToEditorCommand}
                  onBlur={this.handleBlur}
                  onChange={this.onChange}
                  onTab={this.handleTab}
                  placeholder={this.props.placeholder}
                  setRef={editor => (this.domEditor = editor)}
                  stripPastedStyles
                  tabIndex={this.props.tabIndex}
                  spellCheck
                />
                <input className="editorInput" tabIndex="-1" />
              </div>
            )}
            {!isFullscreen && (
              <WysiwygBottomControls
                isPreviewMode={isPreviewMode}
                onClick={this.toggleFullScreen}
                onChange={this.handleDrop}
              />
            )}
          </div>
          {/* PREVIEW WYSIWYG FULLSCREEN */}
          {isFullscreen && (
            <div
              className={cn('editorWrapper')}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={{ marginTop: '0' }}
            >
              <PreviewControl
                onClick={this.toggleFullScreen}
                characters={this.getCharactersNumber()}
              />
              <PreviewWysiwyg data={this.props.value} />
            </div>
          )}
        </EditorWrapper>
        <MediaLib
          onToggle={this.handleToggle}
          isOpen={isMediaLibraryOpened}
          onChange={this.addLinks}
        />
      </WysiwygProvider>
    );
  }
}

Wysiwyg.defaultProps = {
  autoFocus: false,
  className: '',
  deactivateErrorHighlight: false,
  disabled: false,
  error: false,
  onBlur: () => {},
  onChange: () => {},
  placeholder: '',
  resetProps: false,
  style: {},
  tabIndex: '0',
  value: '',
};

Wysiwyg.propTypes = {
  autoFocus: PropTypes.bool,
  className: PropTypes.string,
  deactivateErrorHighlight: PropTypes.bool,
  disabled: PropTypes.bool,
  error: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onBlur: PropTypes.func,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  resetProps: PropTypes.bool,
  style: PropTypes.object,
  tabIndex: PropTypes.string,
  value: PropTypes.string,
};

export default Wysiwyg;
