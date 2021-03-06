---
title: 整个OS[1] —— 内存管理（一）
tags: ["code"]
date: "2020-07-02"
---

> [英文原文地址](http://www.osdever.net/tutorials/view/memory-management-1)，by Tim Robinson
> 该网站可能已经关闭

## 简介

这篇教程试图帮助你实现你自己的操作系统的内存管理。我假定你决定写一个属于自己的操作系统内核，并且你已经到达了“打印一个字符串到屏幕上”的水平。祝贺 —— 你已经超过了大多数人。

内存管理器（这里指的是物理内存管理器）是操作系统中最底层的部分之一，并且它是划分你电脑内存的必不可少的一部分。注意，你的内核中可能有很多内存管理器，每一个都在不同层面上运行。我在这儿解释最低级的一个。这里的分配器不是一个 `malloc()`，除非你愿意每次都拿到一个4096比特长度的内存。

我不准备告诉你它确切的是什么。而是给你一些例子，而且你很容易就能复制到我的结果，但是每个操作系统做的事情都有些稍微不一样。如果你准备写一个属于自己的操作系统，你可能不能直接复制粘贴别人写好的代码。

在这里，我假设你的内核跑在有保护架构的最高权限上。在X86架构中，这意思是你的内核跑在386或者更新架构的保护模式的PL0（privilege level 0）中。我不是钦点使用x86架构，但是除非有人给我其他意见，我还是会一直以x86架构的例子。我同样给出C语言的例子，当然你自己写汇编语言，或者 Pascal（这个语言能做到吗？）都可以，但是我相信对于做这些事情，C语言是一个半通用的语言。我也一直在我自己的内核中用C语言。

如果这个“教程”过长调乏味，我感到很遗憾。与“教你该做什么”不同（市面上已经有各种各样关于硬件指南、架构手册和简单内核实现），我想教给你如何，以及为什么要做这些事。希望这篇文章给你一些启示。

## 技术规范

低层的内存管理器会相当的简单。当 bootloader 把控制权交给内核代码的时候，你就获得了电脑硬件的全部权限。你的代码运行在内存中的某些地方，而且你已经设置了某种栈和数据段的区域。简而言之，你已经设置好了操作环境，足以调用你所谓的 `main()` 函数，打印 “Hello world” 然后停止。

物理内存管理器应该是代码中首先运行的部分（当然，除了你写的输出字符串到屏幕的代码）。如果你的内核已经能运行到了引用全局变量的程度（意思是你的数据段存在），调用过程（procedures）然后输出到屏幕（意思是你可以访问其余的物理地址），你可能会很迷惑，只能切换到图形模式然后编写GUI。这或许是可行的（实际上这是到1995时候Windows的理念），但是你做更复杂的OS事情时候，这就不管用了（再次是Win9x的哲学）。

物理地址管理器的工作是非常简单：切分物理地址到一个合理大小的块，然后把它分给内核使用。简单的说，我们称每个块为页（page）：在 x86，一个页默认4KB。

在现代处理器架构中，X86架构是相当独特的，它同时处理段（segment）和页（page）。也就是说，内存通过段来引用，段又依次引用原始字节和页面中的内存块。使用这种页架构有两个优点：

与386架构一样，大多数其他的32位架构把4GB的地址空间分成页。而x86引入了分段，它允许操作系统把内存当作代码、数据、栈……但是在这方面，x86架构与其他处理器不同。所以把分段的x86操作系统移植到其他架构几乎是不可能的；同样，没有主流的编译器可以在32位模式上处理分段，因此你只能在分段操作系统上编写汇编语言。
如果没有分页，x86架构只能寻址16MB的物理地址。这就可以追溯到286：作为24为总线上运行的16位处理器，它仅能够映射16MB的地址空间。没有段，你只能够使用64KB。当386处理器发布时，它把地址分成了4KB的页，这样做优点是32位处理器可以访问全部的4GB地址空间。缺点是，如果要大于64KB，则不能在小于4KB的块中分配内存（继续往下，这个问题将不再是个问题）。

所以，我们将在32位架构上使用分页的内存管理器。到这里，可能就有人坚定的使用分段了。我痛恨分段。你可以选择是否使用分段，但你不会在我这里得到任何分段的内存管理器教程。

不错。现在我们可以深入了解一些细节了。我们的目的是在内核中彻底消除物理地址这种概念，除了内存管理器。这么做，你的操作系统可以独立诸如机器到底有多少内存以及如何拆分等事情。比如奔腾及以上的处理器可以给你提供4MB的页，这么做的话，36位的物理地址空间就可以提供64GB的空间（虽然虚拟地址空间仍然限制4GB）。
在你的操作系统上使用正确的物理内存地址管理器，就能够充分利用有大量内存的机器，而不用在内存管理器之外做任何更改。不然，你可能会需要重新编译所有的应用程序（不仅仅是内核），最起码这很枯燥。

## 组织

基本上，你的内存管理器需要先留出一段内存才能管理其余的内存。
这听起来有点像先有鸡还是先有蛋的剧情。我该怎么分配内存控制信息（比如长度）在我的内存调度器运行前呢？

这儿有两种方式实现：

1. 在内存块的头部，留出一部分内存来存储分配信息
2. 为分配的每个块预留一个内存区域

如果你分配一块小内存时候（比如一个比特），则方法一很有效。这通常被用于 `malloc()` 风格的分配器。然而，我们想要用页来管理内存，现在在每个页上面存放控制信息有点浪费。在这个方案中，控制信息可能被用户程序强行黑入：通过强行写入在你分配的内存之前的一比特，可能会使调度器崩溃。

因此，对于底层的分配器来说，方法2通常是最好的。记住，此时我们就好像全局数据一样，可以随意访问任意的物理内存。我们只需要将指针指向那个地方，就可以直接读写它了。在这一点上，我想介绍一种查找内核的简便方法（至少在x86上）。如果你听不懂，或者不在乎，可以跳过下面部分。

你的 bootloader 可能加载你的内核到1MB的标记（跳出了BIOS的范围），然后跳转到该标记。因此，你需要链接内核，然后它才能找到1MB以上的代码和数据。
随后，你开始加载并运行用户程序。你会需要把内存地址分为用户和内核空间：用户空间存放所有的用户代码和数据，内核空间保存内核和设备驱动。用户应用程序无权访问内核。没有什么能够阻止你把内核设置在1MB以下，并把用户程序放在更高位置（比如从2GB开始 —— 记住，你的虚拟地址空间完全独立于你的物理地址空间）。许多操作系统（起码有Win9x，NT 和 Linux）倾向于让内核在2GB以上，然后用户空间在2GB以下。那如果内核实际加载为1MB，我们如何做到这一点？有了分页，这就好说了：直接指向相应的页表实体到正确的物理地址，然后链接内核，这样它就可以从地址  `0xC0000000` 开始。

但是把内存管理器放在 bootloader 中并不实际。我们需要一个特殊处理，不用启用分页就能让地址 `0xC0000000` 当作 `0x10000`。然后我们启动分页，并避免重定位内核地址。我们可以调整内核代码的代码和数据基地址来实现。记住，处理器是通过把虚拟地址（例如这里的  `0xC0000000`）到段基地址然后发送到地址总线来形成物理地址（或者，如果启用分页，发送到MMU）。所以只要我们的地址是连续的（没有间隙或者跳跃），那可以让处理器将任何虚拟地址与任何物理地址关联。我们刚才的例子，内核位于 `0xC0000000` 但是加载 `0x01000000`，我们需要一个段基地址，它把 `0xC0000000` 加入到 `0x01000000` 中。那就是说 `0xC0000000 + base = 0x01000000`。这很简单：我们的段基地址需要为`0x41000000`。当我们引用一个在 `0xC0001000` 全局变量时候，CPU把 `0x41000000` 和得到的 `0x1001000` 相加。这恰好是 bootloader 加载我们的内核的时候。如果我们稍后启用分页，并将地址 `0xC0000000` 映射到 `0x01000000`（使用一个基地址为0的段），那么将继续使用相同的地址。

到这儿，那些不关心内核位置的人重新加入了进来。如果你还记得话，我们将留出一块单独的内核内存来管理其余部分。记住，我们将以较小的块（x86上是4KB）来管理内存，如果每个块使用的控制信息小于块（页面）本身的大小，它就能运行。

至少我们需要知道哪些页被分配了，哪些没有。我们可以立刻想到用位图（bitmap）。每一个位表示一个页 —— 在x86上，我们仅需要使用 32768 的物理地址来管理他。在256MB的系统中，我们想要一个8192字节的位图来管理所有 65536 个页。低级内存管理器仅仅需要知道哪些页面被分配。最终，我们可能需要知道诸如块的大小、由哪个进程分配了它、哪个用户有权利访问它……但我们在这里只关心如何切分物理地址，并为内核更高层的部分提供接口。

位图的一大优点就是节省内存而且简单。每一个页面仅需要一个位的控制信息就行了：表示是否被分配。但是，我们需要在每次分配页面的时候搜索整个位图。在大型的操作系统中，搜索时间就变得尤其重要了。

另一种方法（我相信 Linux 和 Windows NT 是这么干的）就是使用页面栈。空闲页面的（物理）地址被压入栈；当分配页面的时候，下一个地址从栈中弹出并使用。页面释放时，页面被重新压入栈顶。这样，分配（或释放）就转化了指针的递增（或递减）问题。但是，尽管大多数分配不要求物理地址是连续的（MMU可以使不连续的地址空间对于用户来说是连续的），就如DMA一样。但是如果有东西需要物理地址是连续的，那么内存管理器需要从栈中间取出地址，这会使事情变得复杂。

栈的实现形式使选择特定的物理地址也变得十分困难。回到DMA的例子，ISA DMA要求地址来自前16MB内存（由于24位地址总线）。如果我们编写软盘控制器驱动程序，我们想要一个16MB以下地址的缓冲区。一个简单的解决方法就是维护两个栈：一个低于16MB，另一个是其余内存。为了充分利用系统的内存，我们可以从“低”栈取“main”内存，虽然我们通常不需要为了区区一个软盘驱动器维护16MB。但如果我们的系统最初只有8MB呢？

## 初始化

最初，我们需要分配给控制信息一些内存，不管它是位图还是栈。控制信息的数量和系统中的内存会是成比例存在。为了确定到底需要给控制信息多少内存，最好在 bootloader 调用 BIOS 时候确定。可以读取 CMOS NVRAM 获取到底有多少内存（仍然在保护模式），但是它只能够告诉你前64MB内存。你需要调用 BIOS 中断 `15h` 才能正确执行。如果不以 VM86 模式运行，那这可能是最好的办法了。

然后我们知道了用户系统到底多少内存。现在我们分一块内存给内存管理器。在编写分配器之前，究竟怎么做呢？我们想要在分配器管辖之外分配一些内存：保留内存。记住，我们系统中已经有很多的“保留内存”了：BIOS、BDA，甚至内核本身。以上这些都不应该被调用。所以为什么不直接把位图或者页表栈放在内核部分的末尾，作为一种动态全局变量呢？

我们已经知道了内核的开始和结束位置（比如你可以在 GNU ld 脚本中将符号设置到内核映像的末尾）。由此我们知道内核了究竟有多大，然后就可以避免分配器接触内核空间 —— 把内核的内存分配出去可能会导致系统直接崩溃！因此，我们可以通过位图或栈区域的大小来扩大内核的大小，用一个指针指向这个区域的开始，把它标记成位图或栈本身的“保留内存”。如果是位图，我们需要把这个区域全设为1。对于页栈，我们压入所有除了保留地址的所有地址。BDA也是这么做的（0x500往下的内存，之后需要运行VM86监视器），BIOS/ROM也是。
初始化函数需要启动分页，我们稍后再说。

## 分配

我们的第一个内存管理函数是物理内存分配器。它会标记一个物理页表为已用，然后返回其地址。如果栈来实现，这就很简单了：我们追踪空闲页面的数量，并在分配页面时候减少空闲页面的数量，并在返回栈顶的地址。对于位图，我们可能需要多做点周折，扫描位数组然后标记一个为已使用。
我更喜欢栈的方法。

回到分配特殊地址的问题上，例如用于ISA DMA的16MB以下的地址：对于位图来说是非常简单的（只需要停在特定的位移量就行了）。对于栈，你可能就需要维护两个页栈，第二个分配器会扫描主栈，然后找出某个特定的地址，最后标记为已使用。我更倾向于双栈的设计。同样需要注意的是，很难从堆栈中分配连续范围的地址。不过很巧，大多数时候我们可以一次重复分配一页来进行管理。

如果没有多余的页了呢？嗯……那么我们就需要在硬盘中有一个交换文件，我们需要交换页面，直到有足够的空闲空间。然而，如果我们这么做，我们还需要写很多的内核架构（最起码是磁盘和文件系统驱动程序）。所以，基本不可能内存不够。你不可能把你Hello world内核的1GB内存全都分配出去吧？

你的底层分配器返回的地址是物理地址。那就是说，你的内核可以根据需要进行多次读取和写入。你可以放数据。但是，需要你的内存管理器变得越来越有强大，这样你可以开始将页面从虚拟地址空间映射到内存的物理页面上。

## 释放

释放就是高效版的分配的相反操作，所以我不打算详细讲解。对于位图，清空比特；对于栈，把地址压入栈即可。就这么简单。

## 映射

从这里开始，页表体系架构开始变得有用。简而言之（处理器手册对此作了更好的讲解），分页允许你从软件层面控制地址空间。你可以随意映射页；你可以给页应用保护；你可以通过页错误按需分配和映射页面（或者直接完全模拟内存访问）。

我将把MMU的介绍留给硬件手册，为此，我将继续x86架构举例（尽管其他架构也不尽相同）。386和更高架构使用了三级转换方案：PDBR（Page Directory Base Register，页面目录基址寄存器，简称CR3）包含页目录的物理地址。页目录是内存中的一个页面，分为1024个32位的字（word）或者页面实体，每一个字（word）都是页表的物理地址。同样，每个页表分成为1024个页表实体。每个字（word）都是在内存中的一个页的物理地址。

注意，要跨越4GB的4096字节的页面，物理地址不需要使用32位。PDBR，PDE 和 PTS 只需要20位，因此剩下的12位被当作标志。这些标志会被用于给页和页表以保护（读/写模式，用户/特权模式），并且他们可以将单个页和页表标记为当前或者非当前。还有一个“被访问”的标志，当一个页或者页表被访问时候，处理器会设置这个标记。通过切换 PDBR，你可以在不同的上下文中使用不同的页目录和页表。因此不同的应用程序可以使用不同的地址空间。

分页功能是极其强大，只有在你开始写用户程序，用地址空间时候才能意识到它的好处。现在，我们需要写一个内存管理器来管理各种各样的页目录和页表。

记住，页目录和页表在内存中仅仅是普通的页。处理器需要知道其物理地址。每一个进程只有一个页目录并且每个目录可以最多1024个页表。我们可从之前写的物理分配器中正常的分配它们。页目录和页表地址需要对齐：即低12位必须是0（否则它们干扰本来读/写/保护/访问位）。

在我们启用页表前我们需要一个有效的PDBR和页目录，和一个有效的页表（无论什么时候运行）。当前页表需要标识当前EIP的映射：当我们给CR0设置分页位时候，CPU会仍然运行当前地址，因此最好在执行的任何位置都有一些有效的指令。这就是为什么最好在启用分页最好将内核定位在将要结束的任何地址上。

因此，在启用分页之前，我们需要分配一个页目录和一个页表。你可以使用页分配器，或者直接保留一个巨大的全局变量（4096字节）。无论哪种方式都一样。如果使用全局变量，确保他们是页对齐的。

将所有你不用的实体清零。这会清除当前位，以防访问时候造成页错误。如果希望页面错误看起来体面，可以将其他位设置为一些特殊的模式。每个PDE（和页表）覆盖了你的4MB的地址空间，对于你的内核来说足够了。如果没有，愿闻其详。每个PTE只覆盖了4KB，所以你可能需要几个PTE来覆盖你的内核（如果不够，愿闻其详……）。假定你没有动态重定位你的内核（为什么这么说？因为他是第地址空间的第一个用户，应该不可能冲突），你可以将数字适当地插入到已分配的页目录和页表中。稍后你将使内存映射函数做的更严密。

所有的这些都需要到刚才提到的内存管理器的初始化中。因为你的内存管理器应该分配所有机器指定的内存从剩下的内核中，返回时候，开启分页和保持地址形式相同（如果不，那么从最后一个函数调用在栈上的返回地址会是错的）是个好习惯。所以，设置你的页目录和页表，启动分页，做一次远跳转（重新加载CS段）并且重新加载其他的选择器（SS、DS、ES、FS和GS）。既然已经启动了分页，使用基地址为零的段是有意义的，尽管没有理由强制这么做。

幸运的是，我们现在运行在分页功能下。所有地址都要通过我们之前写好的页目录和页表。物理内存的其余部分并不一定映射到新的地址空间中 —— 需要的是CPU当前运行的代码的部分（实际上，你需要映射整个内核：数据、栈，所有内容）我们想要在视频内存上映射，以便我们可以输出一些信息。所以全部的内存映射变得十分必要。

## 内存映射

乍一看，这似乎很容易。只需要在当前页目录和页表的正确页面写一些字。如果必要，分配一个新的页表。然而，CPU使用页目录和页表的物理地址。而我们使用的都是虚拟地址。围绕着这件事这就有了各种方法：

1. 映射所有物理地址到地址空间，这样可以以 1:1 完成（就是说，物理内存从地址空间的底部寻址）或者在某个偏移量（即 `0xD0000000` 开始访问物理内存）来完成。这种方法是简单（Win9x使用这种方法）。缺点是，如果用户在系统中安装了任意数量的内存，其必须都是可寻址的。想象如果用户有4GB的内存，那么就没有地址空间了……
2. 映射每个页到地址空间，并在与真实页面并行的虚拟页面目录中记录它们的虚拟地址。这个虚拟页目录可以存储每个页表的虚拟地址，而实际的页目录存储它们的物理地址。如果必须直接处理的物理内存只有页目录/页表，这种方法肯定是好的。但是，仅仅是映射就花了不少内存空间 —— 对于一个小系统，这不划算。
3. 映射页目录到其本身。这听起来是一个奇怪的分形内存映射器，但是实际上效果很好。通过将固定的一个PDE设置成关联的页面目录的物理地址，可以将PDE和PTE作为单独的地址进行寻址。如果将每个页目录的1023号元素（0到1023）设置为页目录本身的物理地址，则处理器会将页目录视为最后一个页表。他会认为PDE为PTE，并将PTE视为地址空间的前4MB中的单个32位字。你可以使用地址空间的前4KB作为原始页面目录中的实体。这样做的好处是既美观又简单。他的缺点是只能映射当前地址空间内的页面映射。

举例子来说，Windows NT 映射 512MB 的物理内存到内核地址空间（方法1），页表直接映射到地址空间（方法3）。本人来说，我更愿意用第三种方法，即使它可能需要一段时间让你理解。第一个方法对于简单的内核来说有其优点。无论哪种方式，页面映射器干的事情都很简单。在每个阶段给予正确的保护：在PTE，对该页面应用所需的保护；在PDE上，对该4MB区域用所需的保护。每个PDE应该通常设置读写和用户可见，除非你有什么独到的原因，让整个4MB空间对于用户不可访问。

## 总览

这就是我们的简单物理内存管理器。如果你想要 HAL 风格的机器抽象，则可能需要一个可从调度器调用的地址空间切换函数（在x86上，这仅仅是 `MOV CR3，addr`）。 如果要使用完整的 VMS 或 NT 风格的异步设备体系结构，则需要一个例程，它可以锁定虚拟地址空间中的缓冲区，并记录与之相关的物理页面； 不过，这属于“高级”设计，对于简单的 `Minix` 或 `Linux` 模型，你可能不需要它。

在我们可以充分使用我们的地址之前，我们需要一个更复杂的内存管理器，因此来看内存管理教程的下一部分。

## 批注

### 物理内存

物理内存指的是装在电脑上真实的内存。鉴于虚拟内存可能被内核适当的映射，物理内存依赖于电脑硬件的配置。虽然在典型的系统中最大的内存组件是DRAM，物理地址空间的某些区域可能映射为ROM（比如PC BIOS）或者为内存的设备（例如显卡帧缓冲区）

### bootloader

引导程序，见维基百科：<https://zh.m.wikipedia.org/zh-cn/%E5%95%9F%E5%8B%95%E7%A8%8B%E5%BC%8F>

### 内存管理单元（Memory Management Unit）

MMU是管理分页和保护的硬件部分。i386系列的MMU是与处理器集成的；在其他的一些架构上（例如早期的摩托罗拉68000处理器和基于8086的Psion Series 3），MMU是一个位于处理器和主存储器之间的独立设备。
