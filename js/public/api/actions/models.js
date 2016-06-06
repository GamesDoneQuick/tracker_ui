import _ from 'underscore';
import $ from 'jquery';

function onModelStatusLoad(model) {
    return {
        type: 'MODEL_STATUS', model, status: 'loading',
    };
}

function onModelStatusSuccess(model) {
    return {
        type: 'MODEL_STATUS', model, status: 'success',
    };
}

function onModelStatusError(model) {
    return {
        type: 'MODEL_STATUS', model, status: 'error',
    };
}

function onModelCollectionReplace(model, models) {
    return {
        type: 'MODEL_COLLECTION_REPLACE', model, models
    };
}

function onModelCollectionAdd(model, models) {
    return {
        type: 'MODEL_COLLECTION_ADD', model, models
    };
}

function onModelCollectionRemove(model, models) {
    return {
        type: 'MODEL_COLLECTION_REMOVE', model, models
    };
}

export function modelStatus(model, status) {
    return {
        type: 'MODEL_STATUS', model, status,
    };
}

// TODO: Better solution than this
const modelTypeMap = {
    speedrun: 'run'
};

function loadModels(model, params = {}) {
    return (dispatch) => {
        dispatch(modelStatus(model, 'loading'));
        $.get(`${API_ROOT}search`, {...params, type: modelTypeMap[model] || model}).
            done((models) => {
                dispatch(onModelCollectionAdd(model,
                    models.reduce((o, v) => {
                        if (v.model.toLowerCase() === `tracker.${model}`.toLowerCase()) {
                            o[v.pk] = v.fields;
                        }
                        return o;
                    }, {})
                ));
                dispatch(modelStatus(model, 'success'));
            }).
            fail((data) => {
                dispatch(modelStatus(model, 'error'));
            });
    }
}

function onNewDraftModel(model) {
    return {
        type: 'MODEL_NEW_DRAFT', model
    };
}

function newDraftModel(model) {
    return (dispatch) => {
        dispatch(onNewDraftModel(model));
    };
}

function onDeleteDraftModel(model) {
    return {
        type: 'MODEL_DELETE_DRAFT', model
    }
}

function deleteDraftModel(model) {
    return (dispatch) => {
        dispatch(onDeleteDraftModel(model));
    };
}

function onDraftModelUpdateField(model, pk, field, value) {
    return {
        type: 'MODEL_DRAFT_UPDATE_FIELD', model, pk, field, value
    };
}

function updateDraftModelField(model, pk, field, value) {
    return (dispatch) => {
        dispatch(onDraftModelUpdateField(model, pk, field, value));
    };
}

function onSetInternalModelField(model, pk, field, value) {
    return {
        type: 'MODEL_SET_INTERNAL_FIELD', model, pk, field, value
    };
}

function setInternalModelField(model, pk, field, value) {
    return (dispatch) => {
        dispatch(onSetInternalModelField(model, pk, field, value));
    };
}

function onSaveDraftModelError(model, error, fields) {
    return {
        type: 'MODEL_SAVE_DRAFT_ERROR', model, error, fields
    };
}

function saveDraftModels(models) {
    return (dispatch) => {
        _.each(models, (m) => {
            dispatch(setInternalModelField(m.type, m.pk, 'saving', true));
            const url = m.pk < 0 ? `${API_ROOT}add/` : `${API_ROOT}edit/`;
            $.post(url, _.extend({type: modelTypeMap[m.type] || m.type, id: m.pk}, _.omit(m.fields, (v, k) => k.startsWith('_')))).
                done((savedModels) => {
                    dispatch(onModelCollectionAdd(m.type,
                        savedModels.reduce((o, v) => {
                            if (v.model.toLowerCase() === `tracker.${m.type}`.toLowerCase()) {
                                v.fields.pk = v.pk;
                                o.push(v.fields);
                            } else {
                                console.warn('unexpected model', v);
                            }
                            return o;
                        }, [])
                    ));
                    dispatch(onDeleteDraftModel(m));
                }).
                fail((data) => {
                    const json = data.responseJSON;
                    dispatch(onSaveDraftModelError(m, json ? json.error : data, json ? json.fields : {}));
                }).
                always(() => {
                    dispatch(setInternalModelField(m.type, m.pk, 'saving', false));
                });
        });
    }
}

function saveField(model, field, value) {
    return (dispatch) => {
        if (model.pk) {
            dispatch(setInternalModelField(model.type, model.pk, 'saving', true));
            if (value === undefined || value === null) {
                value = 'None';
            }
            $.post(`${API_ROOT}edit/`,
                {type: modelTypeMap[model.type] || model.type, id: model.pk, [field]: value }).
                done((savedModels) => {
                    dispatch(onModelCollectionAdd(model.type,
                        savedModels.reduce((o, v) => {
                            if (v.model.toLowerCase() === `tracker.${model.type}`.toLowerCase()) {
                                v.fields.pk = v.pk;
                                o.push(v.fields);
                            } else {
                                console.warn('unexpected model', v);
                            }
                            return o;
                        }, [])
                    ));
                }).
                fail((data) => {
                    const json = data.responseJSON;
                    dispatch(onSaveDraftModelError(model, json ? json.error : data, json ? json.fields : {}));
                }).
                always(() => {
                    dispatch(setInternalModelField(model.type, model.pk, 'saving', false));
                });
        }
    }
}

function command(command) {
    return (dispatch) => {
        $.post(`${API_ROOT}command/`, {
            data: JSON.stringify(Object.assign({ command: command.type }, command.params))
        }).done((models) => {
            const m = models[0];
            if (!m) {
                return;
            }
            const type = m.model.split('.')[1];
            dispatch(onModelCollectionAdd(type,
                models.reduce((o, v) => {
                    if (v.model.toLowerCase() === `tracker.${type}`.toLowerCase()) {
                        v.fields.pk = v.pk;
                        o.push(v.fields);
                    } else {
                        console.warn('unexpected model', v);
                    }
                    return o;
                }, [])
            ));
            if (typeof command.done === 'function') {
                command.done();
            }
        }).fail(() => {
            if (typeof command.fail === 'function') {
                command.fail();
            }
        }).always(() => {
            if (typeof command.always === 'function') {
                command.always();
            }
        });
    }
}

export default {
    modelStatus,
    loadModels,
    newDraftModel,
    deleteDraftModel,
    updateDraftModelField,
    setInternalModelField,
    saveDraftModels,
    saveField,
    command,
};
