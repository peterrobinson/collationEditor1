//this is for connection to TC mongo_db database
var tc_services = {
	_get_resource : function (resource_type, result_callback) {
		//urls to call: /ceconfig/?community gives config.json
		// and: cewitness/?witness=Hg&community=CTP&entity=CTP:Group=GP:line=1
		var url = tc_services._dbUrl + resource_type + '&defeat_cache='+new Date().getTime();
		console.log(url);
		$.get(url, function(resource) {
					result_callback(resource, 200);
				}, 'text').fail(function(o) {
					result_callback(null, o.status);
			});
  },
	_getContext : function() {
	//	assumes TC entity format: eg "CTP:entity=Miller:div=MI:line=88"
		var entities=tc_services._entity.split(":");
		var context=entities[0];
		for (var i=1; i<entities.length; i++) {
			context+="_"+entities[i].slice(entities[i].indexOf("=")+1);
		}
		return(context);
	},
	_load_witnesses : function (verse, witness_list, finished_callback, results, i) {
	    if (typeof i === 'undefined') {
				i = 0;
				results = [];
	    }
	    else if (i > witness_list.length - 1) {
				if (finished_callback) finished_callback(results);
				return;
	    }
	    var data = [];
	//    local_services._get_resource('textrepo/json/' + witness_list[i] + '/' + verse + '.json', function (json, status) {
			tc_services._get_resource('cewitness/?witness=' + witness_list[i] + '&community='+tc_services._community+'&entity='+tc_services._entity, function (json, status) {
				if (status === 200) {
				    var j = JSON.parse(json);
				    if (!$.isArray(j)) {
							j = [j];
				    }
				    for (var k = 0; k < j.length; k += 1) {
							var doc_wit = {
								_id : witness_list[i] + '_' + verse,
								context : verse,
								tei : '',
								siglum : j[k].siglum,
								transcription_id : j[k].transcription_id,
								transcription_siglum : j[k].transcription_siglum,
								witnesses : j[k].witnesses
							}
							results.push(doc_wit);
				    }
				}
				if (status === 404) {
					//if this is the base text -- we have a problem, Houston!d
					//actually, we stop before we get to this point inside TC, but good to have this as a backstop
					if (witness_list[i]==CL._data_settings.base_text) {
							alert("The chosen base text \""+witness_list[i]+"\" does not have any text for \""+CL._context+"\". Either supply a text for this section or choose a different base text from the Manage>Collation menu.");
							//abort! abort!. This is messy, actually. No clean ending if it fails
							CL._data_settings.witness_list=[]; //reset to null
							finished_callback([]);
					}
				}
				tc_services._load_witnesses(verse, witness_list, finished_callback, results, ++i);
	    });
	},
};
// local_services provides an implementation which does not require a database
var local_services = {

	//local services settings
	_current_project: 'default',

	//compulsory settings
//restrict to one if you only want one. Could also be set in the community collation menu
	supported_rule_scopes: {'once': 'This place, these wits',
	    			'always': 'Everywhere, all wits'},

//we could standardize display settings across all projects here, rather in
//separate configuration setups for each d

	//optional settings/functions
	//local_javascript
	//local_python_implementations
	//witness_sort
	//display_settings
	//rule_conditions
	//context_input

	//not overridable in project
	//switch_project
	//view_project_summary

	//compulsory service functions

	initialise_editor : function () {
		let searchParams = new URLSearchParams(window.location.search);
		tc_services._dbUrl=searchParams.get('dbUrl');
		tc_services._entity=searchParams.get('entity');
	  tc_services._community=searchParams.get('community');
	  CL._services.show_login_status(function() {
			CL._container = document.getElementById('container');
	//  this provides editor with function to return entity we are looking for
	//note error in collation.js: should say if (CL._context_input && CL._context_input.hasOwnProperty('form'))
	// at point where this is called
  		CL._context_input={result_provider:"tc_services._getContext", form:'tc_index_input.html'};
	//  TC bypasses choice screen and goes straight to collation
			CL._services.get_editing_projects(undefined, function (projects) {
			    CL.load_single_project_menu(projects[0], 'collation', function (){
						//set context and project now to the parameters given
						CL._managing_editor = true;
  					RG.prepare_collation(CL._display_mode);
					});
				});
	  });
	},

	get_login_url : function () { return '#'; },

	get_user_info : function (success_callback) {
		success_callback(local_services._local_user);
	},

	get_user_info_by_ids : function (ids, success_callback) {
	    var user_infos, i;
	    user_infos = {};
	    for (i = 0; i < ids.length; ++i) {
		if (ids[i] === local_services._local_user._id) {
		    user_infos[ids[i]] = local_services._local_user;
		} else {
		    user_infos[ids[i]] = { _id : ids[i], name : ids[i] };
		}
	    }
	    success_callback(user_infos);
	},

	show_login_status: function (callback) {
	    var elem, login_status_message;
	    elem = document.getElementById('login_status');
	    if (elem !== null) {
		elem.innerHTML = '';
		if (callback) {
		    callback();
		}
	    }
	},

	get_editing_projects : function (criteria, success_callback) {
		tc_services._get_resource('ceconfig/?community=' + tc_services._community, function (project) {
			//we add in here, at Cats suggestion, hardwired values for the editor
			project=CL._services.populate_project(project);
			success_callback([project]);
	    });

//	   local_services._get_resource('project/' + CL._services._current_project  + '/config.json', function (project) {
//		success_callback([JSON.parse(project)]);
//	    });
	},

	//hardwire in the project values we want
	populate_project : function(myproject) {
		var project=JSON.parse(myproject);
//		 project.regularization={};
		 project.display_settings_config=JSON.parse('{ \
        "python_file": "collation.greek_implementations", \
        "class_name": "ApplySettings",\
        "configs": [\
            {\
                "id": "view_supplied",\
                "label": "view supplied text",\
                "function": "hide_supplied_text",\
                "menu_pos": 1,\
                "execution_pos": 6,\
                "check_by_default": true,\
                "apply_when": false\
            },\
            {\
                "id": "view_unclear",\
                "label": "view unclear text",\
                "function": "hide_unclear_text",\
                "menu_pos": 2,\
                "execution_pos": 5,\
                "check_by_default": true,\
                "apply_when": false\
            },\
            {\
                "id": "view_capitalisation",\
                "label": "view capitalisation",\
                "function": "lower_case_greek",\
                "menu_pos": 4,\
                "execution_pos": 3,\
                "check_by_default": false,\
                "apply_when": false\
            },\
            {\
                "id": "use_lemma",\
                "function": "select_lemma",\
                "menu_pos": null,\
                "execution_pos": 1,\
                "check_by_default": true,\
                "apply_when": true\
            },\
            {\
                "id": "expand_abbreviations",\
                "label": "expand abbreviations",\
                "function": "expand_abbreviations",\
                "menu_pos": 5,\
                "execution_pos": 1,\
                "check_by_default": true,\
                "apply_when": true\
            },\
            {\
              "id": "show_punctuation",\
              "label": "show punctuation",\
              "function": "show_punctuation",\
              "menu_pos": 6,\
              "execution_pos": 8,\
              "check_by_default": false,\
              "apply_when": true\
          },\
          {\
              "id": "show_xml",\
              "label": "show xml",\
              "function": "show_xml",\
              "menu_pos": 7,\
              "execution_pos": 2,\
              "check_by_default": false,\
              "apply_when": true\
          }\
        ]\
    }');
		project.managing_editor= JSON.parse('"default"');
		project.project=JSON.parse('"'+tc_services._community+'"');
		project.regularisation_classes=JSON.parse('[\
			 {\
					 "name": "None",\
					 "linked_appendix": false,\
					 "keep_as_main_reading": false,\
					 "create_in_SV": false,\
					 "suffixed_label": false,\
					 "value": "none",\
					 "suffixed_reading": false,\
					 "create_in_RG": true,\
					 "create_in_OR": true,\
					 "subreading": false,\
					 "suffixed_sigla": false\
			 },\
			 {\
					 "name": "Reconstructed",\
					 "linked_appendix": false,\
					 "keep_as_main_reading": false,\
					 "create_in_SV": true,\
					 "suffixed_label": false,\
					 "value": "reconstructed",\
					 "suffixed_reading": false,\
					 "create_in_RG": false,\
					 "create_in_OR": true,\
					 "subreading": false,\
					 "identifier": "V",\
					 "suffixed_sigla": true\
			 },\
			 {\
					 "name": "Orthographic",\
					 "linked_appendix": false,\
					 "keep_as_main_reading": false,\
					 "create_in_SV": true,\
					 "suffixed_label": true,\
					 "value": "orthographic",\
					 "suffixed_reading": false,\
					 "create_in_RG": true,\
					 "create_in_OR": true,\
					 "subreading": true,\
					 "identifier": "o",\
					 "suffixed_sigla": false\
			 },\
			 {\
					 "name": "Regularised",\
					 "linked_appendix": false,\
					 "keep_as_main_reading": false,\
					 "create_in_SV": true,\
					 "RG_default": true,\
					 "value": "regularised",\
					 "suffixed_reading": false,\
					 "create_in_RG": true,\
					 "suffixed_label": false,\
					 "subreading": false,\
					 "create_in_OR": true,\
					 "identifier": "r",\
					 "suffixed_sigla": true\
			 },\
			 {\
					 "name": "Abbreviation",\
					 "linked_appendix": false,\
					 "keep_as_main_reading": false,\
					 "create_in_SV": true,\
					 "suffixed_label": false,\
					 "value": "abbreviation",\
					 "suffixed_reading": false,\
					 "create_in_RG": true,\
					 "create_in_OR": true,\
					 "subreading": false,\
					 "suffixed_sigla": false\
			 }\
	 ]');
		return (project);
	},

	get_adjoining_verse : function (verse, is_previous, result_callback) {
	    return result_callback(null);
	},

	get_verse_data : function (verse, witness_list, private_witnesses, success_callback) {
	    if (private_witnesses) {
		return success_callback([], RG.calculate_lac_wits);
	    }
	    tc_services._load_witnesses(verse, witness_list, function (results) {
		    success_callback(results, RG.calculate_lac_wits);
	    });
	},

	// maps siglum to docid
	get_siglum_map : function (id_list, result_callback, i, siglum_map) {
	    var wit;
	    if (typeof i === 'undefined') {
					i = 0;
					siglum_map = {};
	    }
	    if (i >= id_list.length) {
				//in tc: seems this function always exits here, so next call never gets activated
					return result_callback(siglum_map);
	    }
			//for TC -- witid and siglum are always identical.  So we don't do the call to textrepo etc
			siglum_map[id_list[i]] = id_list[i];
			local_services.get_siglum_map(id_list, result_callback, ++i, siglum_map);
			/*
 		  local_services._get_resource('textrepo/json/'+id_list[i]+'/metadata.json', function(wit_text) {
					try {
					    wit = JSON.parse(wit_text);
					    siglum_map[wit.siglum] = id_list[i];
					}
					catch(err) {
					    siglum_map[id_list[i]] = id_list[i];
					}
					local_services.get_siglum_map(id_list, result_callback, ++i, siglum_map);
			});
			//or tc: we really dont n */
	},



	// get a set of rules specified by array of rule ids
	get_rules_by_ids : function(ids, result_callback, rules, i) {
	    var rule_type, resource_type;
	    if (typeof i === 'undefined') {
		rules = [];
		i = 0;
	    }
	    if (i >= ids.length) {
		return result_callback(rules);
	    }

	    rule_type = ids[i].split('_')[0];
	    resource_type = 'project/'+CL._project._id
	    	+ '/rule'
	    	+ '/' + rule_type + (rule_type === 'verse' ? ('/' + ids[i].split('_')[1]) : '')
	    	+ '/' + ids[i] + '.json';
	    local_services._get_resource(resource_type, function(rule, status) {
		if (status === 200) {
		    rules.push(JSON.parse(rule));
		}
		return local_services.get_rules_by_ids(ids, result_callback, rules, ++i);
	    });
	},

	//locally everything is a project so only need project rules
	get_rules : function (verse, result_callback, rules, resource_types, path_type, i) {
	    var path, rules, parsed;
	    if (typeof i === 'undefined') {
		if (typeof path_type === 'undefined') {
		    rules = [];
		    path = 'project/' + CL._project._id + '/rule/global/';
		    path_type = 'global';
		} else {
		    path = 'project/' + CL._project._id + '/rule/verse/' + verse + '/';
		    path_type = 'verse';
		}
		local_services._get_resource_children(path, function (resource_types, status) {
		    local_services.get_rules(verse, result_callback, rules, resource_types ? resource_types : [], path_type, 0);
		});
		return;
	    }

	    if (i >= resource_types.length) {
		if (path_type === 'global') {
		    local_services.get_rules(verse, result_callback, rules, resource_types, 'verse');
		    return;
		} else {
		    return result_callback(rules);
		}
	    }

	    if (resource_types[i].type === 'file') {
		if (path_type === 'global') {
		    path = 'project/' + CL._project._id + '/rule/global/';
		} else {
		    path = 'project/' + CL._project._id + '/rule/verse/' + verse + '/';
		}
		local_services._get_resource(path + resource_types[i].name, function(rule, status) {
		    rule = JSON.parse(rule);
		    //filter out any with global exceptions for this verse
		    if (!rule.hasOwnProperty('exceptions') || rule.exceptions.indexOf(verse) === -1) {
			rules.push(rule);
		    }

		    return local_services.get_rules(verse, result_callback, rules, resource_types, path_type, ++i);
		});
	    } else {
		return local_services.get_rules(verse, result_callback, rules, resource_types, path_type, ++i);
	    }
	},

	// if verse is passed, then verse rule; otherwise global
	update_rules : function(rules, verse, success_callback) {
	    local_services.update_ruleset([], [], rules, verse, success_callback);
	},

	get_rule_exceptions : function(verse, result_callback, rules, resource_types, i) {
	    if (typeof i === 'undefined') {
		rules = [];
		local_services._get_resource_children('project/'+CL._project._id + '/rule/global/', function(resource_types, status) {
		    local_services.get_rule_exceptions(verse, result_callback, rules, resource_types, 0);
		});
		return;
	    }
	    if (i >= resource_types.length) {
		return result_callback(rules);
	    }
	    if (resource_types[i].type === 'file') {
		local_services._get_resource('project/'+CL._project._id + '/rule/global/'+resource_types[i].name, function(rule, status) {
		    rule = JSON.parse(rule);
		    if (rule.exceptions && rule.exceptions.indexOf(verse) !== -1) {
			rules.push(rule);
		    }
		    return local_services.get_rule_exceptions(verse, result_callback, rules, resource_types, ++i);
		});
	    }
	    else {
		return local_services.get_rule_exceptions(verse, result_callback, rules, resource_types, ++i);
	    }
	},

	update_ruleset : function (for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, j, k) {
	    if (typeof i === 'undefined') i = 0;
	    if (typeof j === 'undefined') j = 0;
	    if (typeof k === 'undefined') k = 0;
	    if (i < for_deletion.length) {
		local_services._delete_resource(local_services._get_rule_type(for_deletion[i], verse), function () {
		    return local_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, ++i, j, k);
		});
	    } else if (j < for_addition.length) {
		if (typeof for_addition[j]._id === 'undefined') {
		    for_addition[j]._id = (for_addition[j].scope === 'always' ? 'global_' : ('verse_' + verse + '_')) + U.generate_uuid();
		}
		CL._services.get_user_info(function (user) {
		    for_addition[j]._meta = { _last_modified_time : new Date().getTime(), _last_modified_by : user._id, _last_modified_by_display : user.name };
				//this is where we write to the database for remote db

				local_services._put_resource(local_services._get_rule_type(for_addition[j], verse), for_addition[j], function (result) {
			// we know how special we are and we always and only update a rule when we are adding an exception
			return local_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, ++j, k);
		    });
		});
	    } else if (k < for_global_exceptions.length) {
		local_services.get_rules_by_ids([for_global_exceptions[k]._id], function (result) {
		    //we are only asking for a single rule so we can just deal with the first thing returned
		    if (result.length > 0) {
			if (result[0].hasOwnProperty('exceptions')) {
			    if (result[0].exceptions.indexOf(verse) === -1 && verse) {
				result[0].exceptions.push(verse);
			    }
			} else {
			    result[0].exceptions = [verse];
			}
			//first save the exception then continue the loop in callback
			local_services.update_ruleset([], [], [result[0]], undefined, function () {
			    return local_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, j, ++k);
			});
		    } else {
			return local_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, j, ++k);
		    }
		});
	    } else if (success_callback) {
		success_callback();
	    }
	},

	// save a collation to local datastore
	save_collation : function (verse, collation, confirm_message, overwrite_allowed, no_overwrite_message, result_callback) {
	    CL._services.get_user_info(function (user) {
		var resource_type;
		resource_type = 'project/' + CL._project._id + '/user/'+user._id+'/collation/'+collation.status+'/'+verse+'.json';
		collation._meta = { _last_modified_time : { "$date" : new Date().getTime() }, _last_modified_by : user._id, _last_modified_by_display : user.name };
		collation._id = resource_type;
		local_services._get_resource(resource_type, function(result, status) {
		    // if exists
		    if (status === 200) {
			if (overwrite_allowed) {
			    var confirmed = confirm(confirm_message);
			    if (confirmed === true) {
				local_services._put_resource(resource_type, collation, function(result) {
				    return result_callback(true);
				});
			    } else {
				return result_callback(false);
			    }
			} else {
			    alert(no_overwrite_message);
			    return result_callback(false);
			}
		    } else {
			// if doesn't already exist
			local_services._put_resource(resource_type, collation, function(result) {
			    return result_callback(true);
			});
		    }
		});
	    });
	},

	get_saved_stage_ids : function (verse, result_callback) {
	    CL._services.get_user_info(function (user) {
		var r, s, o, a;
		r = null;
		s = null;
		o = null;
		a = null;
		var resource_type;
		resource_type = 'project/' + CL._project._id + '/user/'+user._id+'/collation/regularised/'+verse+'.json';
		local_services._get_resource(resource_type, function(result, status) {
		    r = (status === 200) ? resource_type : null;
		    resource_type = 'project/' + CL._project._id + '/user/'+user._id+'/collation/set/'+verse+'.json';
		    local_services._get_resource(resource_type, function(result, status) {
			s = (status === 200) ? resource_type : null;
			resource_type = 'project/' + CL._project._id + '/user/'+user._id+'/collation/ordered/'+verse+'.json';
			local_services._get_resource(resource_type, function(result, status) {
			    o = (status === 200) ? resource_type : null;
			    resource_type = 'project/' + CL._project._id + '/user/'+user._id+'/collation/approved/'+verse+'.json';
			    local_services._get_resource(resource_type, function(result, status) {
				a = (status === 200) ? resource_type : null;
				result_callback(r, s, o, a);
			    });
			});
		    });
		});
	    });
	},

	load_saved_collation: function (id, result_callback) {
	    local_services._get_resource(id, function(result, status) {
		if (result_callback) result_callback(status === 200 ? JSON.parse(result) : null);
	    });
	},

	get_saved_collations : function (verse, user_id, result_callback, collations, users, i) {
	    var resource_type;
	    if (typeof i === 'undefined') {
		collations = [];
		if (user_id) {
		    return get_saved_collations(verse, user_id, result_callback, collations, [{ name: user_id, type : 'dir'}], 0);
		}
		else {
		    resource_type = 'project/' + CL._project._id + '/user/';
		    local_services._get_resource_children(resource_type, function(users, status) {
			if (status === 200) {
			    return local_services.get_saved_collations(verse, user_id, result_callback, collations, users, 0);
			}
			else result_callback([]);
		    });
		    return;
		}
	    }

	    if (i >= users.length) {
		return result_callback(collations);
	    }

	    if (users[i].type === 'dir') {
		local_services._get_saved_user_collations(users[i].name, verse, function(user_collations) {
		    collations.push.apply(collations, user_collations);
		    local_services.get_saved_collations(verse, user_id, result_callback, collations, users, ++i);
		});
	    }
	    else {
		local_services.get_saved_collations(verse, user_id, result_callback, collations, users, ++i);
	    }
	},

	do_collation : function(verse, options, result_callback) {
	    var url;
	    if (typeof options === "undefined") {
		options = {};
	    }
	    url = 'http://' + SITE_DOMAIN + '/collationserver/' + verse + '/';
	    if (options.hasOwnProperty('accept')) {
		url += options.accept;
	    }
	    $.post(url, { options : JSON.stringify(options) }, function(data) {
		result_callback(data);
	    }).fail(function(o) {
		result_callback(null);
	    });
	},

	//internal service functions/values
	_local_user : {
		_id: 'default',
	},

	_data_repo : 'http://' + SITE_DOMAIN + '/data/',

	_data_store_service_url : 'http://' + SITE_DOMAIN + '/datastore/',

//in TC: replaced by tc_services calls
	_get_resource : function (resource_type, result_callback) {
		var url = local_services._data_repo + resource_type + '?defeat_cache='+new Date().getTime();
		$.get(url, function(resource) {
			result_callback(resource, 200);
		}, 'text').fail(function(o) {
			result_callback(null, o.status);
		});
	},

	_put_resource : function (resource_type, resource, result_callback) {
	    var params = {
		    action : 'put',
		    resource_type : resource_type,
		    resource : JSON.stringify(resource)
	    };
	    $.post(local_services._data_store_service_url, params, function(data) {
		result_callback(200);
	    }).fail(function(o) {
		result_callback(o.status);
	    });
	},

	_delete_resource : function (resource_type, result_callback) {
	    var params = {
		    action : 'delete',
		    resource_type : resource_type
	    };
	    $.post(local_services._data_store_service_url, params, function(data) {
		result_callback(200);
	    }).fail(function(o) {
		result_callback(o.status);
	    });
	},

	// returns children for a resource, e.g.,[{ name: "resource_name", type: "file", size: n }]
	_get_resource_children : function (resource_type, result_callback) {
	    var params = {
		    action : 'list_children',
		    resource_type : resource_type
	    };
	    $.post(local_services._data_store_service_url, params, function(data) {
		result_callback(data, 200);
	    }).fail(function () { result_callback(null, 400); });
	},

	_load_witnesses : function (verse, witness_list, finished_callback, results, i) {
	    if (typeof i === 'undefined') {
		i = 0;
		results = [];
	    }
	    else if (i > witness_list.length - 1) {
		if (finished_callback) finished_callback(results);
		return;
	    }

	    var data = [];
	    local_services._get_resource('textrepo/json/' + witness_list[i] + '/' + verse + '.json', function (json, status) {
		if (status === 200) {
		    var j = JSON.parse(json);
		    if (!$.isArray(j)) {
			j = [j];
		    }
		    for (var k = 0; k < j.length; k += 1) {
			var doc_wit = {
				_id : witness_list[i] + '_' + verse,
				context : verse,
				tei : '',
				siglum : j[k].siglum,
				transcription_id : j[k].transcription_id,
				transcription_siglum : j[k].transcription_siglum,
				witnesses : j[k].witnesses
			}
			results.push(doc_wit);
		    }
		}
		local_services._load_witnesses(verse, witness_list, finished_callback, results, ++i);
	    });

	},

	_get_rule_type: function (rule, verse) {
	    return	'project/'+CL._project._id
	    + '/rule'
	    + '/' + (rule.scope == 'always' ? 'global' : ('verse/'+verse))
	    + '/' + rule._id+'.json';
	},

	_get_saved_user_collations : function(user, verse, result_callback, collations, i) {
	    var types = ['regularised', 'set', 'ordered', 'approved'];
	    if (typeof collations === 'undefined') {
		collations = [];
	    }
	    if (typeof i === 'undefined') {
		i = 0;
	    }
	    if (i >= types.length) {
		return result_callback(collations);
	    }
	    resource_type = 'project/' + CL._project._id + '/user/' + user + '/collation/' + types[i] + '/'+verse+'.json';
	    local_services._get_resource(resource_type, function(collation, status) {
		if (status === 200) {
		    collations.push(JSON.parse(collation));
		}
		return local_services._get_saved_user_collations(user, verse, result_callback, collations, ++i);
	    });
	},

};

CL.set_service_provider(local_services);

