1. Requirements

The collation editor requires python 2.7+ but does not yet support Python3. 

CollateX, which is packaged with the collation editor, requires Java Run Time Environment (JRE) 7 or higher. The version of CollateX included with the collation editor is 1.5, it will be upgraded to 1.6 as soon as possible, other versions of collatex may not work with the collation editor. 

The collation editor has been tested with Firefox only but should also work on Chrome. It may not work on other browsers.


2. Installation and Start up 

2.1 On Mac and Linux

To start the collation editor download the code from github  and navigate to the collation_editor directory. From here run the start up script start.sh. This script should start both collateX and the server that runs the collation editor.

If the script has been successful you should be able to see the collation editor when you visit:
localhost:8080/collation

2.2 On Windows (these instructions are untested)

To start the collation editor download the code from github and in a terminal navigate to the collation_editor directory.

Start CollateX by typing 

java -classpath collatex/lib/\* -Dapp.name="collatex-server" -Dapp.repo="collatex/lib" -Dapp.home="collatex" -Dbasedir="collatex" eu.interedition.collatex.http.Server

If collate has started sucessfully you should be able to see it at:
localhost:7369

In a second terminal start the collation editor by typing

python python/bottle_server.py /path/to/colation_editor

If the script has been successful you should be able to see the collation editor when you visit:
localhost:8080/collation


3. Collating the examples

Currently there is one example available in the collation editor download, it is unfortunately in Greek and uses some Greek specific configurations rather than the deafault ones. To run this example visit start the collation editor following the instructions above. Then visit:
localhost:8080/collation

In the text box type 'B04K1V1' and hit run collation.

This should provide a collation of all Greek minuscule manuscripts of John 6:23.


4. Collating your own texts (with local services)

First prepare your data (see section 7.1.1)

Next configure a project (see section 7.1.2)

Then when you type a unit in the box on the index page of the collation editor you should be able to collate your own data.


6. Customisation

The collation editor can be customised in many ways to support different languages and different editorial models. 





7. Services

7.1 Using the local services

The local services that are packaged with collate provide an implementation of the collation editor which reads from and writes to your local file system. The services themselves will take care of putting all of the project data in the correct place. It is your job as a user to put all your data for collation in the right place. The structure of the datastore is as follows:

collation_editor
. static
. . data
. . . textrepo (see 7.1.1)
. . . .json
. . . . . [1 dir for each of your witnesses]
. . . . . . metadata.json
. . . . . . [1 file for each collation unit present in your witness]
. . . project (see 7.1.2)
. . . . [project_dir]
. . . . . user
. . . . . . [one directory per user]
. . . . . . . collation
. . . . . . . . [one folder for each stage of collation that has saved versions]
. . . . . . . . . [one file for each collation unit saved at that stage]
. . . . . rule
. . . . . . global
. . . . . . . [one file for each global rule]
. . . . . . verse
. . . . . . . [one file for each context rule
. . . . . config.json


7.1.1 The text repository

This is where your data for collation goes. Within this directory you must create one directory for each of your witnesses, the directory should be an ID appropriate to that witness. 

7.1.1.1

Within each of these directories there must be a file called 'metadata.json'. This file must contain a JSON object with the following two keys: '_id' and 'siglum'. The ID value (a string) must match the name of the directory for the witness. The siglum value (also a string) will determine how witness will be referred to in the collation editor interface and in any generated apparatus. The values can be the same if your data allows this but both keys should still be provided. You can add other keys if they are useful to you but the collation editor only requires, and will only use, these two. An example follows:

{
"siglum" : "01",
"_id" : "NT_GRC_01_B04"
}


7.1.1.2 Text for collation

Each of your witnesses must be broken down into the units you want to collate. While collate should be able to collate large chunks of data the collation editor is best suited to texts that can be broken down into shorter units (it was written for collating the new testament so verse sized chunks are ideal!). Within each witness directory a json file should be provided for each chunk of text present in that witness (for an explanation of how the collation editor processes lacunose and omitted texts please see section 7.1.1.3). The file structure for these files is quite complex. In time I hope to release a script to create these files from TEI. However, since TEI is so flexible, the script will not be able to handle every possible use of the encoding.

Each file should have (as a minimum) the following top level structure:

{
"transcription_id" : a string that matches the directory name and the '_id' value in your metadata.json file for this witness,
"transcription_siglum" : a string that matches the 'siglum' value in your metadata.json file
"siglum" : the siglum to be used to identify this witness at this unit
}

If this collation unit is omitted (as apposed to lacunose) this is all you need. In many cases the "siglum" and the "transcription_siglum" will share the same value but in cases where there are two instances of the same section of text you will want to be able to distinguish between them and the siglum is used to do this. In writing this I realise that in the local services implementation we actually made no allowance in the storage structure for a collation unit to occur twice in the same witness. I will endevour to remedy this in a future release. 

If the collation unit has text in your witness then you must also add the top level key "witnesses". This is where things start to get complicated. The value of this key must be a list. It is essentially a list of all the data for all the 'witnesses' or 'hands' in this physical witness. If you have no corrections in this section of text then this would just be a list containing just one object. The object representing each hand should have the following structure:

{
"id": a string denoting the siglum of this hand (with no correctors it should match the "siglum" value
"tokens": a list of token objects, one for each word in the hand
}

A token object must minimally consist of the following

{"index": an integer, the editor requires sequential even numbers
"t": a string - the token sent to collate for collation (unless a rule is applied). This must not be an empty string or collate will not work
"reading": a string which should match the id of the parent object
"original": a string representing the word in its original state in the witness. If you do no processing of the "t" then these will be the same. If you do some tidying up such as always lower casing then this allows the editor to go back to the original version before the processing. For display settings are always applied to the original (unless you have specified a setting that uses something else).
"rule_match": a list of strings. This list of string is used when applying rules. The list should include all strings that should be considered a match for this token. For example in Greek Manuscripts there are certain shorthand characters used for things such as final nu characters. They are purely authographic differences so both the abbreviated and expanded strings would apear in this list. Depending on the settings either could have been used to make the rule and we always want it to apply in either case. In the simplest case this list will consist of a single string that matches 'original'. 

}

Extra things can be added to this minimum structure. If you are writing your own customisation for things like applying settings you will need to encode any extra data you need in the JSON at this point (see section 6). 

In addition the following section explains how gaps can be encoded in the tokens to distinguish between lacunose and omitted text

7.1.1.3 lacunose and omitted sections

The editor can make a distinction between lacunose sections of text. lacunose is used for text which is absent because it is missing due to physical damage to the manuscript, or missing pages. Omitted is used for text which is omitted form the running text but the manuscript it would have been written on had it been present is there. 

The editor assumes text is omitted unless your data tells in otherwise.

To encode lacunose text in addition to the required keys listed in 7.1.1.2 you will need to add the following. When the gap follows a word (as in is not before the first word of the context unit). This is done by adding two extra keys to the editor. 

"gap_after": a boolean (should always be true)
"gap_details": the details of the gap (what you want to appear between <> in the editor eg. lac 2 char

If you have a gap before the very first extant word in the given unit for a witness then you must add the following two keys to the first token.

"gap_before": a boolean (should always be true)
"gap_before_details": the details of the gap (what you want to appear between <> in the editor eg. lac 2 char



7.1.1.4 lacunose and omitted context units 

It can also be the case that an entire context unit is absent in a witness. If the unit is missing due to being lacunose (e.g. the page it would be on is missing) then the witness simply does not need a json file for this unit in the witness folder. If the unit is omitted because a scribe just left it out then a json file must be created but there should be no "witnesses" key.


7.1.2 The project data

As a user you should not need to worry about anything in this directory with the exception of the project configuration detailed in 7.1.2.1. Documentation is included for completeness and so you can find data without using the collation editor should you want/need to.

7.1.2.1 Project configuration

This is yet another JSON object. It should be at the path /collation_editor/static/data/project/[project_id]/config.json.

Required keys with explanations:

{
"_id": the id of the project (must agree with the parent directory name)
"witnesses": a list of IDs of all the witnesses to be collated. Each must have an entry in your textrepo.
"base_text": the id of the witness you want to use as the base text. Must be one of the the ids in your "witnesses" key
"editors": a list of ids of users that have permissions to edit this project (must at least contain your own user id (default is "default")
"managing_editor": the id of the user who is in overall control of this project (should be you!)

}

Other keys are also allowed. See customistion section for details


7.1.2.2 Generated data




7.2 customised services

To plug the collation editor into your own architecture you will need to write a set of services to provide the links between your data and the collation editor. These services should be written in javascript. This section documents the services that are required, what data they are provided with and what they must return. 






