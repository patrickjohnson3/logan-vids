"use strict";

// Parent mode rendering.

function renderParent() {
  renderParentSettings();
  renderParentVideoList();
}

function renderParentSettings() {
  els.settingCode.value = state.settings.unlockCode;
  els.settingAudioFeedback.checked = state.settings.audioFeedback;
  els.settingYouTubeControls.checked = state.settings.youtubeControls;
  els.settingSpeechRate.value = state.settings.speechRate;
  els.speechRateOutput.value = state.settings.speechRate;
  els.settingTheme.value = state.settings.theme;
  els.settingVideoGridOrder.value = state.settings.videoGridOrder;
  renderParentStorageWarning();
}

function renderParentStorageWarning() {
  els.storageMessage.textContent = storageWarning;
}

function renderParentVideoList() {
  const activeEditor = getParentVideoItem(editingVideoId)?.querySelector(".parent-video-edit");
  els.parentVideoList.innerHTML = "";
  els.emptyParentMessage.hidden = getVideoCount() > 0;

  getVideos().forEach((video, index) => {
    const item = document.createElement("li");
    item.className = "parent-video-item";
    item.dataset.videoId = video.id;

    const title = document.createElement("p");
    title.className = "parent-video-title";
    title.textContent = video.title;
    const url = document.createElement("p");
    url.className = "parent-video-url";
    url.textContent = video.youtubeUrl;
    const tags = document.createElement("p");
    tags.className = "parent-video-tags";
    tags.textContent = video.tags.length > 0 ? `Tags: ${tagsToString(video.tags)}` : "No tags";

    if (editingVideoId === video.id) {
      item.append(url, activeEditor || makeVideoMetadataEditor(video));
      els.parentVideoList.append(item);
      return;
    }

    const actions = document.createElement("div");
    actions.className = "parent-video-actions";
    actions.append(
      makeParentVideoAction(
        "Edit",
        `Edit ${video.title}`,
        "edit",
        () => startEditingVideo(video.id)
      ),
      makeParentVideoAction(
        "Up",
        `Move ${video.title} up`,
        "up",
        () => moveVideo(video.id, -1),
        index === 0
      ),
      makeParentVideoAction(
        "Down",
        `Move ${video.title} down`,
        "down",
        () => moveVideo(video.id, 1),
        index === getVideoCount() - 1
      ),
      makeParentVideoAction(
        "Delete",
        `Delete ${video.title}`,
        "delete",
        () => deleteVideo(video.id),
        false,
        "danger-action"
      )
    );

    item.append(title, tags, url, actions);
    els.parentVideoList.append(item);
  });
}

function makeVideoMetadataEditor(video) {
  const form = document.createElement("form");
  form.className = "parent-video-edit";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = video.title;
  titleInput.maxLength = MAX_TITLE_LENGTH;
  titleInput.required = true;
  titleInput.addEventListener("input", () => titleInput.setCustomValidity(""));
  titleLabel.append(titleInput);

  const tagsLabel = document.createElement("label");
  tagsLabel.textContent = "Tags";
  const tagsInput = document.createElement("input");
  tagsInput.type = "text";
  tagsInput.value = tagsToString(video.tags);
  tagsInput.maxLength = MAX_TAGS_LENGTH;
  tagsInput.placeholder = "trains, music, calm";
  tagsInput.addEventListener("input", () => tagsInput.setCustomValidity(""));
  tagsLabel.append(tagsInput);

  const actions = document.createElement("div");
  actions.className = "parent-video-edit-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "primary-action";
  saveButton.textContent = "Save";
  saveButton.dataset.parentAction = "save";
  const cancelButton = makeSmallButton("Cancel", () => cancelEditingVideo(video.id));
  cancelButton.dataset.parentAction = "cancel";
  actions.append(saveButton, cancelButton);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveVideoMetadata(video.id, titleInput, tagsInput);
  });
  form.append(titleLabel, tagsLabel, actions);
  return form;
}

function makeParentVideoAction(
  label,
  accessibleName,
  action,
  onClick,
  disabled,
  className
) {
  const button = makeSmallButton(label, onClick, disabled, className);
  button.dataset.parentAction = action;
  button.setAttribute("aria-label", accessibleName);
  return button;
}
