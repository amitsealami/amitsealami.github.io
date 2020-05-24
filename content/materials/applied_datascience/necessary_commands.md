+++
date = "2017-06-22T03:19:03+06:00"
title = "Tips and Tricks"
tags = ["datascience", "course"]
math = true
+++

This article covers some necessary commands related to hadoop.
<!--more-->

#### Any Generic Unix Commands:

```
hadoop fs -<command>
```

#### Uploading a Local File

```
hadoop fs -put <filename>
```

#### Downloading a Hadoop File

```
hadoop fs -get <filename>
```

### Running Mapping and Reducer

```
hadoop jar /usr/lib/hadoop-0.20-mapreduce/contrib/streaming/hadoop-streaming-2.0.0-mr1-cdh4.1.1.jar -mapper <mapfile.py> -reducer <reducefile.py> -file <mapfile.py> -file <reducefile.py> -input <input_directory_in_hadoop> -output <output_directory_in_hadoop_must_not_exist_before>

```

Fortunately, Cloudera made an alias in the `~/.bashrc` file which reduces the commands to  this:

```
hs <mapper.py> <reducer.py> <input_directory> <output_directory>
```

Check out the file if you want to know how they intelligently created `shell function` and `alias` to reduce that huge command!

### Dry Testing without Running Hadoop
You probably already realized this, but hadoop runs like this:

> run mapper -> sort output -> send output to reducer -> output

Therefore, you can use the same mapper and reducer files in your local machine. For example, I do something like this:

```python
python mapper.py < short_input_file.txt | sort > output.txt
```

As you have guessed, I am using a short version of the actual input file to make things faster. If you are having trouble understanding what happened above, you need to understand a bit about Linux `Shell` Commands, namely `Piping` and `Filtering`.