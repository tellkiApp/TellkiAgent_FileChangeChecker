/**
* This script was developed by Guberni and is part of Tellki's Monitoring Solution
*
* APRIL, 2015
* 
* Version 1.0
*
* DEPENDENCIES:
*		js-md5 v0.1.2 (https://www.npmjs.com/package/js-md5)
*
* DESCRIPTION: Monitor File Change Checker utilization
*
* SYNTAX: node file_change_checker_monitor.js <METRIC_STATE> <FILE_DIRECTORY> <FILE_NAME>
* 
* EXAMPLE: node "file_change_checker_monitor.js" "1" "C:\\Guberni\\Tellki\\working\\" "file.docx"
*
* README:
*		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
*		1 - metric is on ; 0 - metric is off
*
*		<FILE_DIRECTORY> file directory path
*		
*		<FILE_NAME> file name. Can be used the wildcard * to represent any combination of characters.
**/

var fs = require('fs');
var md5 = require('js-md5');

var tempDir = "/tmp";

// METRICS IDS
var metricId = "1470:File Status:9";


// ############# INPUT ###################################

//START
(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length != 3)
	{
		throw new InvalidParametersNumberError();
	}		
	
	monitorInputProcess(args);
}


/*
* Process the passed arguments and send them to monitor execution (monitorFileChangeChecker)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<METRIC_STATE>
	var metricState = args[0].replace("\"", "");
	var FileStatusExecution = (metricState === "1")
	
	//<FILE_DIRECTORY> 
	var directory = args[1];
	
	//<FILE_NAME> 
	var filename = args[2];
	
	
	
	//create request object to pass to the monitor
	var request = new Object()
	request.directory = directory;
	request.filename = filename;
	request.FileStatusExecution = FileStatusExecution;
	
	//call monitor
	monitorFileChangeChecker(request);
	
}


//################# FILE CHANGE CHECKER ###########################

/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorFileChangeChecker(request) {

	var directory = request.directory;
	var filenamePrefix = request.filename;
	
	// Parse filename prefix.
	filenamePrefix = filenamePrefix.replace(/\*/g, "(.*)");
	filenamePrefix = "^"+filenamePrefix+"$"
	
	
	try
	{
		var pattern = new RegExp(filenamePrefix);
	}
	catch(error)
	{
		var ex = new InvalidRegularExpressionError();
		ex.message = error.message;
		throw ex;
	}
	
	
	// Get all matching files
	try
	{
		var files = fs.readdirSync(directory);
		
		var jsonString = "[";
		
		for(var i in files)
		{
			if(pattern.test(files[i]))
			{
				
				var stat = fs.statSync(directory+'/'+files[i]);
			
				if(!stat.isDirectory())
				{
					jsonString += "{";
					
					jsonString += "\"filename\":\""+files[i]+"\",";
					jsonString += "\"lastModificationDate\":\""+ new Date(stat.mtime).getTime() +"\",";
					jsonString += "\"timestamp\":\""+ new Date().toISOString() +"\",";
					jsonString += "\"object\":\""+files[i]+"\"";
					
					jsonString += "},";
					
				}
			}
		}
		
		if(jsonString.length > 1)
			jsonString = jsonString.slice(0, jsonString.length-1);
		
		jsonString += "]";
	}
	catch(err)
	{
		var ex = new FileError();
		ex.message = "Path doesn't exist.";
		throw ex;
	}
	
	processResult(request, jsonString);
	
}


function processResult(request, data)
{
	var file = getFile(request.directory+"/"+request.filename);
	
	var toOutput = [];

	if(file)
	{	
		var previousData = JSON.parse(file);
		
		var newData = JSON.parse(data);
		
		for(var i = 0; i < newData.length; i++)
		{
			var endFile = newData[i];
			var initFile = null;
			
			for(var j = 0; j < previousData.length; j++)
			{
				if(previousData[j].filename === newData[i].filename)
				{
					initFile = previousData[j];
				
					var outMetric = new Object();
					outMetric.id = metricId;
					outMetric.timestamp = endFile.timestamp;
					outMetric.object = endFile.object;
					
					if(initFile.lastModificationDate != endFile.lastModificationDate)
					{
						outMetric.value = 0;
					}
					else
					{
						outMetric.value = 1;
					}
					
					toOutput.push(outMetric);
					
					
					break;
				}
			}
		}
		
		setFile(request.directory+"/"+request.filename, data);

		output(toOutput);
	
	}
	else
	{
		setFile(request.directory+"/"+request.filename, data);
		process.exit(0);
	}
	
	
}



//################### OUTPUT METRICS ###########################

/*
* Send metrics to console
* Receive: metrics list to output
*/
function output(toOutput)
{
	for(var i in toOutput)
	{
		var out = "";
			
		out += toOutput[i].id + "|";
		out += toOutput[i].value;
		out += "|";
		out += toOutput[i].object;
		out += "|";
		
		console.log(out);
	}
}

//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
function errorHandler(err)
{
	if(err instanceof FileError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof CreateTmpDirError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof WriteOnTmpFileError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}
	




// ##################### UTILS #####################

/*
* Get last results if any saved
* Receive: 
* - file path
*/
function getFile(path)
{

		var dirPath =  __dirname +  tempDir + "/";
		var filePath = dirPath + ".filechecker_"+ md5(path) +".dat";
		
		try
		{
			fs.readdirSync(dirPath);
			
			var file = fs.readFileSync(filePath, 'utf8');
			
			if (file.toString('utf8').trim())
			{
				return file.toString('utf8').trim();
			}
			else
			{
				return null;
			}
		}
		catch(err)
		{
			return null;
		}
}



/*
* Save current metrics values to be used to calculate changes on next runs
* Receive: 
* - file path
* - retrieved result
*/
function setFile(path, json)
{
	var dirPath =  __dirname +  tempDir + "/";
	var filePath = dirPath + ".filechecker_"+ md5(path) +".dat";
		
	if (!fs.existsSync(dirPath)) 
	{
		try
		{
			fs.mkdirSync( __dirname+tempDir);
		}
		catch(e)
		{
			var ex = new CreateTmpDirError(e.message);
			ex.message = e.message;
			errorHandler(ex);
		}
	}

	try
	{
		fs.writeFileSync(filePath, json);
	}
	catch(err)
	{
		var ex = new WriteOnTmpFileError(e.message);
		ex.message = err.message;
		errorHandler(ex);
	}
}


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function FileError() {
    this.name = "FileError";
    this.message = "";
	this.code = 15;
}
FileError.prototype = Object.create(Error.prototype);
FileError.prototype.constructor = FileError;

function CreateTmpDirError()
{
	this.name = "CreateTmpDirError";
    this.message = "";
	this.code = 21;
}
CreateTmpDirError.prototype = Object.create(Error.prototype);
CreateTmpDirError.prototype.constructor = CreateTmpDirError;


function WriteOnTmpFileError()
{
	this.name = "WriteOnTmpFileError";
    this.message = "";
	this.code = 22;
}
WriteOnTmpFileError.prototype = Object.create(Error.prototype);
WriteOnTmpFileError.prototype.constructor = WriteOnTmpFileError;

