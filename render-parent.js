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
  els.parentVideoList.innerHTML = "";
  els.emptyParentMessage.hidden = getVideoCount() > 0;

  getVideos().forEach((video, index) => {
    const item = document.createElement("li");
    item.className = "parent-video-item";

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
      item.append(url, makeVideoMetadataEditor(video));
      els.parentVideoList.append(item);
      return;
    }

    const actions = document.createElement("div");
    actions.className = "parent-video-actions";
    actions.append(
      makeSmallButton("Edit", () => startEditingVideo(video.id)),
      makeSmallButton("Up", () => moveVideo(index, -1), index === 0),
      makeSmallButton("Down", () => moveVideo(index, 1), index === getVideoCount() - 1),
      makeSmallButton("Delete", () => deleteVideo(video.id), false, "danger-action")
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
  actions.append(
    saveButton,
    makeSmallButton("Cancel", () => {
      editingVideoId = null;
      renderParentVideoList();
    })
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveVideoMetadata(video.id, titleInput, tagsInput);
  });
  form.append(titleLabel, tagsLabel, actions);
  return form;
}
