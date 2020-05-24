+++
date = "2017-06-22T03:19:02+06:00"
title = "Setting up Work Environment"
tags = ["datascience", "course"]
math = true
+++

We will be using the Cloudera-Udacity Hadoop course materials.
<!--more-->

1. Head over [udacity](https://www.udacity.com/course/intro-to-hadoop-and-mapreduce--ud617) if you have not registered already.
1. Next, download the material from [here](https://docs.google.com/document/d/1v0zGBZ6EHap-Smsr3x3sGGpDW-54m82kDpPKC2M6uiY/edit) called  `Cloudera-Udacity-Training-VM-4.1.1.c.zip`. It is around 2GB in size, so make sure you **download it once** and then share it amongst other classmates.
1. Additionally, install [7zip](http://www.7-zip.org/download.html) if you do not have already in Windows. It is considerably faster for unzipping materials. If you are in Linux - you need to open terminal and type

    ```bash
    unzip Cloudera-Udacity-Training-VM-4.1.1.c.zip -d udacity-cloudera
    ```
4. There are several files related to lightweight Hadoop setup from Cloudera in virtual disk image format. Even though it is possible to use VirtualBox to host the virtual image, [VMware](https://my.vmware.com/en/web/vmware/free#desktop_end_user_computing/vmware_workstation_player/12_0) is the preferred choice since it performs better.

6. If you are in Linux, you need to download the bundle file. When we downloaded it, it was `VMware-Player-12.5.7-5813279.x86_64.bundle`. You need to execute the following from terminal:

    ```
    chmod +x VMware-Player-12.5.7-5813279.x86_64.bundle
    sudo ./VMware-Player-12.5.7-5813279.x86_64.bundle
    ```
    > *pro tip: VMWare Player has some advanced options hidden at `/usr/lib/vmware/bin`. For example, `vmware-netcfg` helps you edit VMWare related network settings, which is not available in the regular user interface of VMWare Player.*

    When asked whether to install, install it.

6. Then, open VM Player. Click on Open a virtual machine, and select the vmx file from the extracted directory!
    {{< figure src="../images/2017-06-22-13-02-52.png" title="Opening the VMX file" width="100%">}}
1. If everything was done properly, something like this will show up:
{{< figure src="../images/2017-06-22-13-42-11.png" title="Hadoop is ready for Running!" width="100%">}}

Congratulations! You have successfully completed the setting up of work environment. :)
