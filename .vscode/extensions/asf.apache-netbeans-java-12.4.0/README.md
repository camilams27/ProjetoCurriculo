# Apache NetBeans Language Server Extension for VS Code

<!--

    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.

-->

This is a technology preview of [Apache NetBeans](http://netbeans.org)
based extension for VS Code. Use it to get all the _goodies of NetBeans_
via the VS Code user interface! Run on __JDK8__[*], __JDK11__, __JDK15__, etc.

[*]: <http://github.com/oracle/nb-javac> "Running on JDK8 requires additional download of GPLv2 with ClassPath Exception code"

Invoke "Open Folder" action to open project directories with `pom.xml` or `build.gradle`
build scripts. Edit, compile and debug (with the __Java 8+__ debugger configuration)
the `.java` application and test files in such projects. Debug not only Java code,
but JavaScript, Python, Ruby polyglot programs at once.

## Getting Started

Follow the
[online instructions](https://cwiki.apache.org/confluence/display/NETBEANS/Apache+NetBeans+extension+for+Visual+Studio+Code)
to set your environment up to support
[typical development use-cases](https://cwiki.apache.org/confluence/display/NETBEANS/Apache+NetBeans+extension+for+Visual+Studio+Code).

## Supported Actions

* __Java: Compile Workspace__ - invoke Maven or Gradle build
* __GraalVM: Pause in Script__ - place a breakpoint into first executed polyglot script
* Debugger __Java 8+__ - start test or main class on JDK8+ in polyglot mode
* Progress shown for long running operations with cancel support for selected types
* __Native Image Debugger__ is a new Run configuration added which allows Java style debugging of Ahead of Time compiled native-images, produced by GraalVM. It is experimental feature which works with GDB on Linux. GDB 7.11 or GDB 10.1+ is required due to known issue [#26139](https://sourceware.org/bugzilla/show_bug.cgi?id=26139) in GDB 8 and 9.
* __Micronaut and Spring__ support especially for YAML configuration files with code completion and source code navigation to Java.
* __Test Explorer__ for Java tests results visualization and execution including editor code Lenses.
* Improved Maven and Gradle support including multi-project projects, subprojects opening and Gradle priming builds.
  
## Supported Refactorings

Class level refactorings as well as variable refactorings are supported in VSCode via Apache NetBeans extension. See following screenshots:

![Class Source Actions](https://github.com/apache/netbeans/raw/master/java/java.lsp.server/vscode/images/Source_actions.png) ![Introduce ... refactoring](https://github.com/apache/netbeans/raw/master/java/java.lsp.server/vscode/images/Introduce_refactoring.png)

Some refactorings are two steps with like Override method ... where method to be overriden is selected in 2nd step:

![Override refactoring](https://github.com/apache/netbeans/raw/master/java/java.lsp.server/vscode/images/Override_refactoring.png)

## Test Explorer
NetBeans Language Server provides Test Explorer view which allows to run all tests in a project, examine the results, go to source code and  run particular test.
![Test Explorer](https://github.com/apache/netbeans/raw/master/java/java.lsp.server/vscode/images/Test_explorer.png)


## Native Image Debugger
Experimental Support

NetBeans Language Server allows Java like debugging of native images produced by GraalVM EE native-image tool. It is provided using GDB and via new Run configuration named __Launch Native Image__. This experimental feature works __now__ only on Linux with certain version of GDB, see above. GraalVM Enterprise Edition is needed as it produces full debug information for native images, at this time.

In order to debug native image applications it is necessary to build such native image with debug information available. It can be done by providing following switches for native-image tool: 
- `-g -O0` or 
- `-H:Debug=2 -H:Optimize=0`. 

### Using Native Image Maven Plugin
It is possible to use [Native-Image Maven Plugin](https://www.graalvm.org/reference-manual/native-image/NativeImageMavenPlugin/) to run native-image builds for Maven projects. 
In this case add following `<buildArgs>` into plugin `<configuration>`:
```
<buildArgs>
  <buildArg>-g</buildArg>
  <buildArg>-O0</buildArg>
</buildArgs>
```
Setting project's Maven pom.xml to skip native-image build everytime when project is being built is a good practice.

When native image is built, including debug info then add __Launch Native Image__ configuration to launch.json. Select it in Run & Debug activity window and press F5 to debug Java source code on native image.

## Supported Options

* __netbeans.jdkhome__ - path to the JDK, see dedicated section below
* __netbeans.verbose__ - enables verbose extension logging
* __netbeans.conflict.check__ - avoid conflicts with other Java extensions, see below

## Selecting the JDK

The user projects are built, run and debugged using the same JDK which runs the
Apache NetBeans Language Server. The JDK is being searched in
following locations:

- `netbeans.jdkhome` setting (workspace then user settings)
- `java.home` setting (workspace then user settings)
- `JDK_HOME` environment variable
- `JAVA_HOME` environment variable
- current system path

As soon as one of the settings is changed, the Language Server is restarted.

## Conflicts with other Java Extensions

Apache NetBeans Language Server extension isn't the only Java supporting
extension. To avoid duplicated code completion and other misleading clashes
the extension disables certain functionality known to cause problems, this is done per __Workspace__. 

This behavior can be disabled by setting `netbeans.conflict.check` setting to `false`.

## Contributing

Read [building instructions](https://github.com/apache/netbeans/blob/master/BUILD.md) to help Apache community to
improve the extension.

