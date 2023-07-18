---
title: "有序抖动算法 (Ordered Dithering)"
date: 2023-07-13T15:49:20+08:00
draft: false
summary: "有序抖动算法是 GIF 等很喜欢用的早期的图像压缩算法。因为压缩算法简单迅速，压缩效率高。"
author: 42yeah
---

## 1. 有序抖动算法

抖动算法是非常古早的[图像量化算法](https://surma.dev/things/ditherpunk) - 通常意味着将一个大的数据集映射到一个小的，有限的，值的集合上。想象一下，你有一张 Minecraft 的截图：

{{< imgproc swampy 720px "某一副 Minecraft 沼泽 - 打了光影+水反" >}}

然后这一张图片要在因特网上传播。但因特网本身，是一个[非常昂贵](https://www.allconnect.com/blog/cost-of-high-speed-internet#:~:text=The%20average%20internet%20bill%20in,or%20more%20for%20select%20plans.)的东西。直接发送原图开销很大，因此图片很多时候都会被压缩。有的时候压缩的效果甚至巨烂。抖动算法就是这些烂算法之一，但在早期的因特网一直在被广泛的传播 - 而且再说，我们的早期显示器本身也就只能显示那几种颜色了。因此从显示器的角度触发，图片本身也需要从一个大的数据集（256 真彩色）映射到一个小的数据集（8 色每通道）当中。 这是上述的 Minecraft 图经过 3[BBP](https://www.tutorialspoint.com/dip/concept_of_bits_per_pixel.htm)（3 比特每像素）抖动算法后的结果：

{{< imgproc swampy_dithered 720px "3BPP 抖动过后的图片。" >}}

## 2. 大致思路

那怎么实现这个抖动算法呢？一个大致的思路是使用[抖动矩阵](https://en.wikipedia.org/wiki/Ordered_dithering)。这个矩阵可以是 2x2 的，4x4 的，8x8 的，或者其实任意大小都没什么所谓：

1. 提供一个*抖动矩阵*。
2. 对于图片中的每个像素，计算他在抖动矩阵当中对应的坐标。
3. 把抖动矩阵中的值跟对比标准化后的颜色对比 - 如果抖动矩阵中的值更大， 把这点设为黑色；不然的话，设为白色。

对于一个灰度图，我们只需要对比每个像素一次就好了。但对于 RGB 图片来说，我们需要*每个颜色通道*对比一次。这里是另一个例子，这个 Minecraft 截图中只有红色通道经过了抖动：

{{< imgproc cave_cmp 800px "肩并肩的比对。可以看出，右侧的图片尽管失去了色彩，但还是可以比较简单的认出来原本应该是个啥玩意儿。" >}}

在这个时候抖动算法的巨大优势就开始体现出来了：即使作为一副二元的单色图像，也就是每个像素只能是黑色或白色，整个图像都还是清晰可见，对人眼来说保留了许多特征。与此同时，图像本身被大幅压缩，从原始的PNG格式，大小为377kb，压缩到仅有43kb。

## 3. 抖动矩阵

在了解了一般的概念后，我们应该如何实现抖动算法呢？首先需要生成一个可用的抖动矩阵。最常用的抖动矩阵是拜耳矩阵（Bayer filter, 不要与[拜耳滤镜 (bayer matrix)](https://en.wikipedia.org/wiki/Bayer_filter) 混淆，后者用于照片传感器），也被称为索引矩阵，你可以在[维基百科查看](https://en.wikipedia.org/wiki/Ordered_dithering)。该矩阵可以从最基础的 2x2 拜耳矩阵开始递增计算：

$$
M_2 = \frac{1}{4} \begin{bmatrix}
0 & 2 \\\\\\
3 & 1
\end{bmatrix}
$$

$M_4, M_8, ..., M_n$ 随即可以用这条公式计算：

$$
M_{2n} = \frac{1}{(2n)^2} \begin{bmatrix}
(2n)^2 M_n & (2n)^2 M_n + 2 \\\\\\
(2n)^2 M_n + 3 & (2n)^2 M_n + 1
\end{bmatrix}
$$

这里是一个大概的 C++ 例子：

```c++
Matrix create_initial_bayer()
{
    Matrix initial{
        .mat_width = 2,
        .mat_height = 2,
        .one_over_factor = 4,
    };
    initial.data[0][0] = 0;
    initial.data[0][1] = 2;
    initial.data[1][0] = 3;
    initial.data[1][1] = 1;
    return initial;
}

Matrix bayer_up(const Matrix &mat)
{
    Matrix up{
        .mat_width = mat.mat_width * 2,
        .mat_height = mat.mat_height * 2,
        .one_over_factor = mat.one_over_factor * 4
    };
    for (int y = 0; y < mat.mat_height; y++)
    {
        for (int x = 0; x < mat.mat_width; x++)
        {
            int cell = mat.data[y][x];
            constexpr int fac = 4;
            up.data[y][x] = fac * cell;
            up.data[y][x + mat.mat_width] = fac * cell + 2;
            up.data[y + mat.mat_height][x] = fac * cell + 3;
            up.data[y + mat.mat_height][x + mat.mat_width] = fac * cell + 1;
        }
    }
    return up;
}
```

拿到了拜耳矩阵后，我们就可以开始进行实际的抖动处理了。对于图像中每个像素的每个颜色组成部分，我们执行以下步骤：

1. 确定像素在抖动矩阵中的对应位置。
2. 比较它们的值。
3. 如果抖动矩阵中的值较大，则将其颜色设为黑色；否则，设为白色。

可以通过取得当前像素位置的模运算结果来找到对应的位置：

{{< imgproc illustration 480px "通过取得当前像素位置的模运算结果来找到对应的位置。" >}}

假设颜色已经标准化（范围从0到1），新的颜色可以定义为：

$$
c_{\text{new}} = \begin{cases}
1, & \text{if } c_{\text{old}} > B_{r, c} \\\\\\
0, & \text{otherwise}
\end{cases}
$$

传统的抖动算法非常快，因为它[不涉及浮点数运算](https://stackoverflow.com/a/68192472)。这可以通过推迟抖动矩阵的归一化来实现，就像上面的拜耳矩阵生成代码所示，并且只在乘法后进行除法运算。换句话说，我们可以将颜色归一化到 $[0,1]$ 的范围，而是将抖动矩阵的值缩放到 $[0,255]$ 的范围。当然，会丢失一些精度；但是由于我们正在压缩图像，所以这并不重要。下面是两种抖动算法的结果，并排展示。

{{< imgproc virtually_no_difference 720px "不告诉你哪一个是浮点数实现，哪一个是整形实现的话，你能区分出来吗？" >}}

浮点数的在右边。感觉起来有区别吗？没有？这就对了嘛。

```c++
bool dither(Image &image, int bayer_n)
{
    Matrix bayer = create_initial_bayer();
    for (int i = 0; i < bayer_n - 1; i++)
    {
        bayer = bayer_up(bayer);
    }

    //
    // 部分代码参考自 https://www.visgraf.impa.br/Courses/ip00/proj/Dithering1/ordered_dithering.html :
    // 如果像素的值 (缩放到 0-9) 要比矩阵中对应的数值要小，把它设为黑色；否则设为白色。
    //
    for (int y = 0; y < image.height; y++)
    {
        for (int x = 0; x < image.width; x++)
        {
            Texel t = image.texel_get(x, y);
            int mat_loc_x = x % bayer.mat_width;
            int mat_loc_y = y % bayer.mat_height;
            for (int i = 0; i < 3; i++)
            {
                int d = bayer.data[mat_loc_y][mat_loc_x] * 256 / bayer.one_over_factor;
                if (t[i] <= d)
                {
                    t[i] = (unsigned char) 0;
                }
                else
                {
                    t[i] = (unsigned char) 255;
                }
            }
        }
    }
    return true;
}
```

十行代码就好了。简单，快速，复古。有什么不好的呢？

## 继续阅读

- [A look at various simple dithering algorithms in C++](https://nerdhut.de/2021/09/08/simple-dithering-algorithms/): 解释了什么是抖动算法，以及各种的抖动算法。
- [Shaders Explained: Dithering](https://mtldoc.com/metal/2022/11/20/shaders-explained-dithering): 进一步往下解释，并且介绍了一个新的错误扩散抖动算法：“弗洛伊德-斯坦伯格抖动算法”。
- [StackOverflow: Is this a correct implementation of ordered dithering?](https://stackoverflow.com/questions/54372456/is-this-a-correct-implementation-of-ordered-dithering): 给了一个简单的无浮点顺序抖动算法的实现。
- [Wikipedia: Quantization](https://en.wikipedia.org/wiki/Quantization_(image_processing)): 接受了图像处理当中的“量化”是什么意思。
- [Atkinson Dithering](https://beyondloom.com/blog/dither.html): 介绍了阿克金森抖动算法，另一个图像抖动压缩算法。
