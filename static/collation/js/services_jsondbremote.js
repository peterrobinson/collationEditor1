//this is for connection to TC mongo_db database

var tc_services = {
	_get_resource : function (resource_type, result_callback) {
		//we have to parse the resource_type string and figure out how to read this from the database
		//urls to call: /ceconfig/?community gives config.json
		// and: cewitness/?witness=Hg&community=CTP&entity=CTP:Group=GP:line=1
		var url = tc_services._dbUrl + resource_type + '&defeat_cache='+new Date().getTime();
		console.log(url);
		$.get(url, function(resource) {
					result_callback(resource, 200);
				}, 'text').fail(function(o) {
					result_callback(null, o.status);
			});
  },   //we have to parse the resource_type string and figure out how to write this to the database
	//resource.type: resource._model: decision, resource.tupe: regularization, resource.context.unit: is the entity, resource.scope: once or always
	//esave regularized collation: resource._model: coll.ation. resource.status: regularized; resource.context: entity
	//else: save set collation resource._model: collation. Save the collation! resource.status: set; resource.context: entity
	//save approved collation: resource._model: collation. resource.status: approved; resource.context: entity
	//we use this only for adding rule sets, ie for_addition resources. Written so we need make one and only one call to the database
	_add_rule_set : function (for_addition, verse, result_callback) {
		//create new array from for_addition, with CE field as a string; use model field to tell us what we are looking for
		var send_array=[];
		for (var i=0; i<for_addition.length; i++) {
				send_array.push({id: for_addition[i]._id, community: tc_services._community, entity: verse, model: "regularization", scope: for_addition[i].scope, from: for_addition[i].t, to: for_addition[i].n, ce: JSON.stringify(for_addition[i]) });
		}
		var url = tc_services._dbUrl+'putCERuleSet/?entity='+verse+'&community='+tc_services._community;
		$.ajax({
			type: 'POST',
			url: url,
			data: JSON.stringify({ruleSet: send_array}),
			accepts: 'application/json',
			contentType: 'application/json; charset=utf-8',
			dataType: 'json'
		})
		.done (function(data){
			console.log(data);
			result_callback(200);
		})
		.fail (function(data){
			result_callback(data.success)
		});
	},
	_do_global_exceptions(for_global_exceptions, verse, callback) {
		var url = tc_services._dbUrl+'addCEGlobalExceptions/?entity='+verse+'&community='+tc_services._community;
		var exceptNow=[];
		for (var i=0; i<for_global_exceptions.length; i++) {exceptNow.push(for_global_exceptions[i]._id)};

		$.ajax({
			type: 'POST',
			url: url,
			data: JSON.stringify({exceptions: exceptNow}),
			accepts: 'application/json',
			contentType: 'application/json; charset=utf-8',
			dataType: 'json'
		})
		.done (function(data){
			console.log(data);
			callback(200);
		})
		.fail (function(data){
			callback(data.success)
		});
	},
	_delete_all_rules: function (callback) { //delete everything set for this block
		//we add a check that this is a project leader to stop mischief
		var url = tc_services._dbUrl+'deleteAllRules/?entity='+tc_services._entity+'&community='+tc_services._community+"&user="+tc_services._user;
		$.ajax({
			type: 'POST',
			url: url,
		})
		.done (function(data){
			//unmark this entity as collated
			var dburl=tc_services._dbUrl + 'unMarkEntityCollated/?entity='+tc_services._entity;
			$.post(dburl, function(data2) {
				callback(data);
			});
		})
		.fail (function(data){
			callback(data)
		});
	},
	_delete_rules(for_deletion, verse, callback) {
		//we have an array of ids of records for deletion. Delete them in one go
		var url = tc_services._dbUrl+'deleteRules/?entity='+verse+'&community='+tc_services._community;
		var deleteNow=[];
		for (var i=0; i<for_deletion.length; i++) {deleteNow.push(for_deletion[i]._id)};
		$.ajax({
			type: 'POST',
			url: url,
			data: JSON.stringify({delete: deleteNow}),
			accepts: 'application/json',
			contentType: 'application/json; charset=utf-8',
			dataType: 'json'
		})
		.done (function(data){
			console.log(data);
			callback(200);
		})
		.fail (function(data){
			callback(data.success)
		});
	},
	get_rules: function (entity, result_callback) {
		//go get all the rules from the database.  Check them here for exceptions
		var url = tc_services._dbUrl + 'getRegularizationRules/?entity='+entity+'&community='+tc_services._community+'&defeat_cache='+new Date().getTime();
		console.log(url);
		var rules=[];
		$.get(url, function(resource) {
				//need to insert check for exceptions here
				//two stages of JSON.parse...
					var resArr=JSON.parse(resource);
					for (var i=0; i<resArr.length; i++) {
						var thisRule=JSON.parse(resArr[i]);
						//filter out any with global exceptions for this verse
						if (!thisRule.hasOwnProperty('exceptions') || thisRule.exceptions.indexOf(entity) === -1) {
							rules.push(thisRule);
						}
					}
					result_callback(rules, 200);
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
	//	return(context);
		return(tc_services._entity);  // problem with verbosity? or not?
	},
	_load_witnesses : function (verse, witness_list, override, finished_callback, results, i) {
		var test=true;
		if (test) {
			//new routine goes here
			var url= tc_services._dbUrl+'getCEWitnesses/?community='+tc_services._community;
			$.ajax({
				type: 'POST',
				url: url,
				data: JSON.stringify({witnesses: witness_list, base: CL._data_settings.base_text, entity: tc_services._entity, override: override}),
				accepts: 'application/json',
				contentType: 'application/json; charset=utf-8',
				dataType: 'json'
			})
			.done (function(data){
				//check that we have base..
				if (!data.success) {
					alert("Error reading in the witnesses");
					CL._data_settings.witness_list=[]; //reset to null
					finished_callback([]);
				}
				else  {  //note. In this embedded we are not checking if the base exists. We do that before the collation starts
					var results=[];
					//we might have a warning message: so send it
					if (data.errorMessage!="") alert(data.errorMessage);
					for (var i=0;i<data.result.length;i++) {
						if (Object.keys(data.result[i]).length)
								results.push(JSON.parse(data.result[i]));
					}
					finished_callback(results);  //results will have everything
				}
			})
			.fail (function(data){
				alert("Error fetching witnesses");
				CL._data_settings.witness_list=[]; //reset to null
				finished_callback([]);
			});
		} else {
			if (typeof i === 'undefined') {
					i = 0;
					results = [];
			}
			else if (i > witness_list.length - 1) {
					if (finished_callback) finished_callback(results);
					return;
			}
			var data = [];
		//    local_services._get_resource'textrepo/json/' + witness_list[i] + '/' + verse + '.json', function (json, status)
				tc_services._get_resource('cewitness/?witness=' + witness_list[i] + '&community='+tc_services._community+'&entity='+tc_services._entity+"&override=false&base="+CL._data_settings.base_text, function (json, status) {
					if (status === 200) {
						var j = JSON.parse(json);
							results.push(j);
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
		}
	},
	_get_saved_stage_ids: function (entity, result_callback) {
		//we just use this to confirm there is a saved collation, which gets opened and read in later
		var r=null, s=null, o=null, a=null;
		var url=tc_services._dbUrl +'isAlreadyCollation/?entity='+entity+'&community='+tc_services._community+'&status=regularised';
		$.get(url, function(status) {
			var resource_type = tc_services._community+'/'+entity+'/regularised';
			r = (status.status) ? resource_type : null;
			url=tc_services._dbUrl +'isAlreadyCollation/?entity='+entity+'&community='+tc_services._community+'&status=set';
			$.get(url, function(status) {
				resource_type =  tc_services._community+'/'+entity+'/set';
				s = (status.status) ? resource_type : null;
				url=tc_services._dbUrl +'isAlreadyCollation/?entity='+entity+'&community='+tc_services._community+'&status=ordered';
				$.get(url, function(status) {
					resource_type =  tc_services._community+'/'+entity+'/ordered';
					o = (status.status) ? resource_type : null;
					url=tc_services._dbUrl +'isAlreadyCollation/?entity='+entity+'&community='+tc_services._community+'&status=approved';
					$.get(url, function(status) {
						resource_type =  tc_services._community+'/'+entity+'/approved';
						a = (status.status) ? resource_type : null;
						result_callback(r, s, o, a);
					});
				});
			})
		})
	},
	_remove_duprdgs: function (collation) {
		var adjustCollation=collation;
//		return collation;  //remove on deploy
		var handkeys=Object.keys(adjustCollation.structure.hand_id_map);
		var hasMod=false;
		for (var i=0; i<handkeys.length && !hasMod; i++) {
			if (handkeys[i].includes("-mod") || handkeys[i].includes("-orig")) hasMod=true;
		}
		if (!hasMod) return adjustCollation; //no orig or mod readings in this line
		//ok. We do have orig and mod readings...

		for (let i=0; i<adjustCollation.structure.apparatus.length; i++) {
			for (let j=0; j<adjustCollation.structure.apparatus[i].readings.length; j++) {
				for (let k=0; k<adjustCollation.structure.apparatus[i].readings[j].witnesses.length; k++) {
					if (adjustCollation.structure.apparatus[i].readings[j].witnesses[k].includes("-mod")) {
						var mod_str=adjustCollation.structure.apparatus[i].readings[j].witnesses[k];
						var mod_pos=mod_str.indexOf("-mod");
						var wit_str= mod_str.slice(0, mod_pos);
						var orig_str=wit_str+"-orig";
						//check: if there is also a orig here, then we check if it is a duplicate
						for (let m=0; m<adjustCollation.structure.apparatus[i].readings[j].witnesses.length; m++) {
							if (adjustCollation.structure.apparatus[i].readings[j].witnesses[m]==orig_str) {
								let modtext="";
								let origtext="";
							//both mod and orig appear in the reading haha. Now check if the text values of each - k and m- are identical
							//here a complication. Reading MIGHT be in SR_text. Check if there is an entry for either in standoff_subreadings
								let modIsSub=false;
								let origIsSub=false;
								if (adjustCollation.structure.apparatus[i].readings[j].hasOwnProperty("standoff_subreadings")) {
									if (adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings.includes(mod_str)) modIsSub=true;
									if (adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings.includes(orig_str)) origIsSub=true;
								}
								//ok, length of text may vary in sub readings of course
								if (modIsSub) {
									for (let n=0; n<adjustCollation.structure.apparatus[i].readings[j].SR_text[mod_str].text.length; n++) {
									  modtext+=adjustCollation.structure.apparatus[i].readings[j].SR_text[mod_str].text[n][mod_str]["t"]
									  modtext+=" ";
									}
									if (!origIsSub) {
										for (let n=0; n<adjustCollation.structure.apparatus[i].readings[j].text.length; n++) {
											origtext+=adjustCollation.structure.apparatus[i].readings[j].text[n][orig_str]["t"];
											origtext+=" ";
										}	
									}
								} 
								if (origIsSub) {
									for (let n=0; n<adjustCollation.structure.apparatus[i].readings[j].SR_text[orig_str].text.length; n++) {
									  origtext+=adjustCollation.structure.apparatus[i].readings[j].SR_text[orig_str].text[n][orig_str]["t"]
									  origtext+=" "
									}
									if (!modIsSub) {
										for (let n=0; n<adjustCollation.structure.apparatus[i].readings[j].text.length; n++) {
											modtext+=adjustCollation.structure.apparatus[i].readings[j].text[n][mod_str]["t"];
											modtext+=" ";
										}	
									}
								}
								if (!modIsSub && !origIsSub) {
									for (let n=0; n<adjustCollation.structure.apparatus[i].readings[j].text.length; n++) {
										modtext+=adjustCollation.structure.apparatus[i].readings[j].text[n][mod_str]["t"];
										origtext+=adjustCollation.structure.apparatus[i].readings[j].text[n][orig_str]["t"];
										modtext+=" ";
										origtext+=" ";
									}
								}
								if (modtext==origtext) { //we have a duplicate! remove for each text...; adjust name of each mod element; remove orig element
									if (modIsSub) {var nrdgs=adjustCollation.structure.apparatus[i].readings[j].SR_text[mod_str].text.length}
									else {var nrdgs=adjustCollation.structure.apparatus[i].readings[j].text.length}
									for (let n=0; n<nrdgs; n++) { 
										if (modIsSub) {
											if (n==0) Object.defineProperty(adjustCollation.structure.apparatus[i].readings[j].SR_text, wit_str, Object.getOwnPropertyDescriptor(adjustCollation.structure.apparatus[i].readings[j].SR_text, mod_str));
											Object.defineProperty(adjustCollation.structure.apparatus[i].readings[j].SR_text[wit_str].text[n], wit_str, Object.getOwnPropertyDescriptor(adjustCollation.structure.apparatus[i].readings[j].SR_text[wit_str].text[n], mod_str));
											delete adjustCollation.structure.apparatus[i].readings[j].SR_text[wit_str].text[n][mod_str];
											adjustCollation.structure.apparatus[i].readings[j].SR_text[wit_str].text[n].reading[0]=wit_str;
											if (n==nrdgs-1) delete adjustCollation.structure.apparatus[i].readings[j].SR_text[mod_str];
										} 
										if (!modIsSub) {
											Object.defineProperty(adjustCollation.structure.apparatus[i].readings[j].text[n], wit_str, Object.getOwnPropertyDescriptor(adjustCollation.structure.apparatus[i].readings[j].text[n], mod_str));
											delete adjustCollation.structure.apparatus[i].readings[j].text[n][mod_str];
										} 
										if (origIsSub) {
											if (n==0) delete adjustCollation.structure.apparatus[i].readings[j].SR_text[orig_str]
										} 
										if (!origIsSub) {
											delete adjustCollation.structure.apparatus[i].readings[j].text[n][orig_str];
										}
										if (!modIsSub) {
											for (let p=0; p<adjustCollation.structure.apparatus[i].readings[j].text[n].reading.length; p++) {
												if (adjustCollation.structure.apparatus[i].readings[j].text[n].reading[p]==mod_str) {
													adjustCollation.structure.apparatus[i].readings[j].text[n].reading[p]=wit_str;
												}
												if (adjustCollation.structure.apparatus[i].readings[j].text[n].reading[p]==orig_str) {
													adjustCollation.structure.apparatus[i].readings[j].text[n].reading.splice(p, 1);
													p--;
												}
											}
										} else {  // adjust in standoff array
											for (let p=0; p<adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings.length; p++) {
												if (adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings[p]==mod_str) {
													adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings[p]=wit_str;
												}
												if (adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings[p]==orig_str) {
													adjustCollation.structure.apparatus[i].readings[j].standoff_subreadings.splice(p, 1);
													p--;
												}
											}
										}
									}
									for (let n=0; n<adjustCollation.structure.apparatus[i].readings[j].witnesses.length; n++) {
										if (adjustCollation.structure.apparatus[i].readings[j].witnesses[n]==mod_str) {
											adjustCollation.structure.apparatus[i].readings[j].witnesses[n]=wit_str;
										}
										if (adjustCollation.structure.apparatus[i].readings[j].witnesses[n]==orig_str) {
											adjustCollation.structure.apparatus[i].readings[j].witnesses.splice(n, 1);
											n--;
										}
									}
								}
							}
						}
					}
				}
			}
		}
		return adjustCollation;
	},
	_save_collation: function (entity, collation, confirm_message, overwrite_allowed, no_overwrite_message, result_callback) {
		//does it exist already?
		var adjusted=false;
		//we add here: if this is approved collation we adjust to filter out -mod and -orig fake entries
			if (collation.status=="approved") {
				var savecollation=tc_services._remove_duprdgs(collation);
				adusted=true;
			}	else {savecollation=collation}
			var url = tc_services._dbUrl + 'isAlreadyCollation/?entity='+entity+'&community='+tc_services._community+'&status='+savecollation.status+'&defeat_cache='+new Date().getTime();
			$.get(url, function(status) {
					if (status.status) { //already got one
						if (overwrite_allowed) {
								var confirmed = confirm(confirm_message);
								if (confirmed === true) {
									var url = tc_services._dbUrl + 'putCollation/?entity='+entity+'&community='+tc_services._community+'&status='+savecollation.status+'&adjusted='+adjusted;
									var thisCollation={ce: JSON.stringify(savecollation)};
									$.ajax({
										type: 'POST', url: url, data: JSON.stringify({collation: thisCollation}), accepts: 'application/json', contentType: 'application/json; charset=utf-8', dataType: 'json'
									}).done (function(data){
										if (collation.status=="approved") tc_services._save_collation_apparatus(entity, result_callback);
										else return result_callback(true);
									})
									.fail (function(data){return result_callback(false)})
								} else {
									return result_callback(false);
								}
						} else {
							return result_callback(false);
						}
					} else {  //not got one
						var url = tc_services._dbUrl + 'putCollation/?entity='+entity+'&community='+tc_services._community+'&status='+savecollation.status+'&adjusted='+adjusted;
						var thisCollation={ce: JSON.stringify(savecollation)};
						$.ajax({type: 'POST', url: url, data: JSON.stringify({collation: thisCollation}), accepts: 'application/json', contentType: 'application/json; charset=utf-8', dataType: 'json'})
						.done (function(data){
							if (collation.status=="approved") tc_services._save_collation_apparatus(entity, result_callback);
							else return result_callback(true);
						})
						.fail (function(data){return result_callback(false)});
					}
			});

	},
	_load_saved_collation: function (id, result_callback) {
		var url = tc_services._dbUrl + 'loadSavedCollation/?id='+id+'&defeat_cache='+new Date().getTime();
			$.get(url, function(result) {
					if (result_callback) result_callback(result.status ? JSON.parse(result.result):null);
			});
	},
	_get_rule_exceptions: function (entity, result_callback) {   //pull in all global rules for whuch this verse is an EXCEPTION; add them to rules arrau
			//shows cases where we have an exception so we can remove the exception (if we like!)
		var url = tc_services._dbUrl + 'getRuleExceptions/?entity='+entity+'&community='+tc_services._community+'&defeat_cache='+new Date().getTime();
			$.get(url, function(resource) {
					return result_callback(resource);
			});
	},
	get_rules_by_ids: function (ids, result_callback) {
		var url = tc_services._dbUrl+'getRulesByIds/?community='+tc_services._community;
		$.ajax({
			type: 'POST',
			url: url,
			data: JSON.stringify({findByIds: ids}),
			accepts: 'application/json',
			contentType: 'application/json; charset=utf-8',
			dataType: 'json'
		})
		.done (function(data){
			console.log(data);
			result_callback(data);
		})
		.fail (function(data){
			callback({success: 0})
		});
	},
	_save_collation_apparatus: function(entity, result_callback) {
		//tc adds this: when we approved the apparatus we write it to the collation db
		var url = SITE_DOMAIN + '/collation/apparatus';
		$.ajax({
			type: 'POST',
			url: url,
			data: {
				settings: JSON.stringify(CL.get_exporter_settings()),
				format: 'positive_xml',
				data: JSON.stringify([{"context": CL._context, "structure": CL._data}])
			}
		})
		.done (function(data){
//			console.log(data);
			var dburl=tc_services._dbUrl + 'putCollation/?entity='+entity+'&community='+tc_services._community+'&status=xml/positive&adjusted=true';
			var thisCollation={ce: data};
			$.ajax({
				type: 'POST', url: dburl, data: JSON.stringify({collation: thisCollation}), accepts: 'application/json', contentType: 'application/json; charset=utf-8', dataType: 'json'
			}).done (function(data){
				//now do the same for negative apparatus
				$.ajax({
					type: 'POST',
					url: url,
					data: {
						settings: JSON.stringify(CL.get_exporter_settings()),
						format: 'negative_xml',
						data: JSON.stringify([{"context": CL._context, "structure": CL._data}])
					}
				})
				.done (function(data){
	//				console.log(data);
					var dburl=tc_services._dbUrl + 'putCollation/?entity='+entity+'&community='+tc_services._community+'&status=xml/negative';
					var thisCollation={ce: data};
					$.ajax({
						type: 'POST', url: dburl, data: JSON.stringify({collation: thisCollation}), accepts: 'application/json', contentType: 'application/json; charset=utf-8', dataType: 'json'
					}).done (function(data){
						//finally, mark that a collation exists for this entity
						var dburl=tc_services._dbUrl + 'markEntityCollated/?entity='+entity;
						$.post(dburl, function(data) {
							return result_callback(true);
						});
					});
				});
			});
		});
	},
	//hardwire in the project values we want
	_populate_project : function(myproject) {
		var project=JSON.parse(myproject);
//		 project.regularization={};
		 project.rule_conditions=JSON.parse('{ \
			 "python_file": "collation.greek_implementations", \
			 "class_name": "RuleConditions", \
			 "configs": [\
				 {\
					 "id": "ignore_supplied",\
					 "label": "Ignore supplied markers",\
					 "linked_to_settings": true,\
					 "setting_id": "view_supplied",\
					 "function": "ignore_supplied",\
					 "apply_when": true,\
					 "check_by_default": false,\
					 "type": "string_application"\
				},\
				{\
 					 "id": "ignore_unclear",\
 					 "label": "Ignore unclear markers",\
 					 "linked_to_settings": true,\
 					 "setting_id": "view_unclear",\
 					 "function": "ignore_unclear",\
 					 "apply_when": true,\
 					 "check_by_default": false,\
 					 "type": "string_application"\
				 },\
				 {\
						 "id": "only_nomsac",\
						 "label": "Only apply to Nomina Sacra",\
						 "linked_to_settings": false,\
						 "function": "match_nomsac",\
						 "apply_when": true,\
						 "check_by_default": false,\
						 "type": "boolean"\
					}\
				]\
			}');
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
		//set various parameters. this is pretty hacky.
		project.display_settings_config.configs[0].check_by_default=tc_services._viewsuppliedtext;
		project.display_settings_config.configs[1].check_by_default=tc_services._viewuncleartext;
		project.display_settings_config.configs[2].check_by_default=tc_services._viewcapitalization;
		project.display_settings_config.configs[4].check_by_default=tc_services._expandabbreviations;
		project.display_settings_config.configs[5].check_by_default=tc_services._showpunctuation;
		project.display_settings_config.configs[6].check_by_default=tc_services._showxml;
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
					 "RG_default": true,\
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
					 "suffixed_sigla": false\
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
					 "value": "regularised",\
					 "suffixed_reading": false,\
					 "create_in_RG": true,\
					 "suffixed_label": false,\
					 "subreading": false,\
					 "create_in_OR": true,\
					 "identifier": "r",\
					 "suffixed_sigla": false\
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
};
// local_services provides an implementation which does not require a database
// we keep a shell of local_services to provide a frame in which we summon the database as neeed

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
		if (!tc_services._dbUrl) { //coz of a bug in older browsers
			let ns=new URLSearchParams(window.location.search.substring(0,1)+'&'+window.location.search.substring(1));
			tc_services._dbUrl=ns.get('dbUrl');
		}
		tc_services._entity=searchParams.get('entity');
	   tc_services._community=searchParams.get('community');
	   tc_services._viewsuppliedtext=JSON.parse(searchParams.get('viewsuppliedtext'));
	   tc_services._viewuncleartext=JSON.parse(searchParams.get('viewuncleartext'));
	   tc_services._viewcapitalization=JSON.parse(searchParams.get('viewcapitalization'));
	   tc_services._expandabbreviations=JSON.parse(searchParams.get('expandabbreviations'));
	   tc_services._showpunctuation=JSON.parse(searchParams.get('showpunctuation'));
	   tc_services._showxml=JSON.parse(searchParams.get('showxml'));
		tc_services._project={_id:tc_services._community};
	  tc_services._user=searchParams.get('user');  //hex id of user. We use this to check the person is authorized
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
			project=tc_services._populate_project(project);
			success_callback([project]);
	    });

//	   local_services._get_resource('project/' + CL._services._current_project  + '/config.json', function (project) {
//		success_callback([JSON.parse(project)]);
//	    });
	},

	get_adjoining_verse : function (verse, is_previous, result_callback) {
	    return result_callback(null);
	},

	get_verse_data : function (verse, witness_list, private_witnesses, success_callback) {
	    if (private_witnesses) {
		return success_callback([], RG.calculate_lac_wits);
	    }
	    tc_services._load_witnesses(verse, witness_list, false, function (results) {
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
	},


	// get a set of rules specified by array of rule ids
	get_rules_by_ids : function(ids, result_callback, rules, i) {
			//again, way simpler in database!
			tc_services.get_rules_by_ids(ids, result_callback);
	},

	//locally everything is a project so only need project rules
	//rewritten for dbservices
	get_rules : function (verse, result_callback, rules, resource_types, path_type, i) {
	//much simplified; We just go get all the rules from the datatase
		return result_callback(tc_services.get_rules(verse, result_callback));
	},

	// if verse is passed, then verse rule; otherwise global
	update_rules : function(rules, verse, success_callback) {
	    local_services.update_ruleset([], [], rules, verse, success_callback);
	},

	//pulls out all cases where this verse is an exception to a universal rule (much easier if this is a database!)
	get_rule_exceptions : function(verse, result_callback, rules, resource_types, i) {
			tc_services._get_rule_exceptions(verse, result_callback);
			return;
	},
	

//redone for database to reduce calls across the network: basically, need just one call to do it all
	update_ruleset : function (for_deletion, for_global_exceptions, for_addition, verse, success_callback) {
	    if (for_deletion.length>0) {
					tc_services._delete_rules(for_deletion, verse, function (result) {
							return local_services.update_ruleset([], for_global_exceptions, for_addition, verse, success_callback);
					});
	    }
			else if (for_addition.length>0) {
				CL._services.get_user_info(function (user) {
					for (var m=0; m<for_addition.length; m++) {
						for_addition[m].community=tc_services._community;
						for_addition[m]._meta = { _last_modified_time : new Date().getTime(), _last_modified_by : user._id, _last_modified_by_display : user.name };
						if (typeof for_addition[m]._id === 'undefined') {
						    for_addition[m]._id = (for_addition[m].scope === 'always' ? 'global_' : ('verse_' + verse + '_')) + U.generate_uuid();
						}
					}
			    	//this is where we write to the database for remote db
					tc_services._add_rule_set(for_addition, verse, function (result) {
					// we know how special we are and we always and only update a rule when we are adding an exception
						return local_services.update_ruleset([], for_global_exceptions, [], verse, success_callback);
				  });
				});
	    }
			else if (for_global_exceptions.length>0) {
				tc_services._do_global_exceptions(for_global_exceptions, verse, function (result) {
					return local_services.update_ruleset([], [], [], verse, success_callback);
				});
	    }
			else if (success_callback) {
				success_callback();
	    }
	},

	// save a collation to local datastore
	//if it is approved.. we write it also to the database
	save_collation : function (verse, collation, confirm_message, overwrite_allowed, no_overwrite_message, result_callback) {
			tc_services._save_collation(verse, collation, confirm_message, overwrite_allowed, no_overwrite_message, result_callback);
	},
	get_saved_stage_ids : function (verse, result_callback) {
		tc_services._get_saved_stage_ids(verse, result_callback);
	},

	load_saved_collation: function (id, result_callback) {
			tc_services._load_saved_collation(id, result_callback);
	},

	get_saved_collations : function (verse, user_id, result_callback, collations, users, i) {
	    var resource_type;
	    if (typeof i === 'undefined') {
		collations = [];
		if (user_id) {
		    return get_saved_collations(verse, user_id, result_callback, collations, [{ name: user_id, type : 'dir'}], 0);
		}
		else {
		    resource_type = 'project/' + tc_services._project._id + '/user/';
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
			if (typeof options.rules === "undefined") options.rules=[]
	    url = SITE_DOMAIN + '/collationserver/' + verse + '/';
	    if (options.hasOwnProperty('accept')) {
		url += options.accept;
	    }
	    $.post(url, { options : JSON.stringify(options) }, function(data) {
				//for somre reason... this can come back null and not show as a fail; we catch this in result_callaback in regularize.js line 380
					result_callback(data);
			}).fail(function(o) {
				result_callback(null);
	    });
	},

	//internal service functions/values
	_local_user : {
		_id: 'default',
	},

	_data_repo : SITE_DOMAIN + '/data/',

	_data_store_service_url : SITE_DOMAIN + '/datastore/',

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

//I don't think we need this at all now
	_get_rule_type: function (rule, verse) {
	    return	'project/'+tc_services._project._id
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
	    resource_type = 'project/' + tc_services._project._id + '/user/' + user + '/collation/' + types[i] + '/'+verse+'.json';
	    local_services._get_resource(resource_type, function(collation, status) {
		if (status === 200) {
		    collations.push(JSON.parse(collation));
		}
		return local_services._get_saved_user_collations(user, verse, result_callback, collations, ++i);
	    });
	},
	get_json_apparatus: function (collation, callback) {
    var a = document.createElement('a');
    var blob = new Blob([JSON.stringify(collation)], {'type':'application/json'});
    a.href = window.URL.createObjectURL(blob);
    a.download = collation.context;
    a.click();
		callback();
	},
	get_apparatus_for_context: function (success_callback) {
		var url;
		url = SITE_DOMAIN + '/collation/apparatus';
		//let's try and pull back the apparatus this way...
		$.fileDownload(url, {httpMethod: "POST",
			data: {
				settings: JSON.stringify(CL.get_exporter_settings()),
				format: 'positive_xml',
				data: JSON.stringify([{"context": CL._context, "structure": CL._data}])
			},
			successCallback: function () {
				if (success_callback) {
					success_callback();
				}
			}
			//can also add a failCallback here if you want
		});
	},


};
CL.set_service_provider(local_services);
