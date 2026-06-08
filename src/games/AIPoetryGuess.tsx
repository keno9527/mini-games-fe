import { useCallback, useMemo, useRef, useState } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'playing' | 'over'
type PoetryStage = '初中' | '高中' | '拓展'

interface PoetryScene {
  id: string
  line: string
  author: string
  title: string
  stage: PoetryStage
  imagePrompt: string
  visualWords: string[]
  palette: [string, string, string]
}

interface Round {
  scene: PoetryScene
  options: PoetryScene[]
}

type PoetrySeed = Pick<PoetryScene, 'line' | 'author' | 'title' | 'stage'>

const CONFIG: Record<Level, { rounds: number; options: number; baseClues: number; hintCost: number; label: string; stages: PoetryStage[] }> = {
  简单: { rounds: 6, options: 4, baseClues: 3, hintCost: 15, label: '初中 · 4 选 1', stages: ['初中'] },
  中等: { rounds: 8, options: 5, baseClues: 2, hintCost: 25, label: '初高中 · 5 选 1', stages: ['初中', '高中'] },
  复杂: { rounds: 10, options: 6, baseClues: 1, hintCost: 35, label: '高中拓展 · 6 选 1', stages: ['高中', '拓展'] },
}

const POEM_SEEDS: PoetrySeed[] = [
  { line: '关关雎鸠，在河之洲', author: '佚名', title: '关雎', stage: '初中' },
  { line: '窈窕淑女，君子好逑', author: '佚名', title: '关雎', stage: '初中' },
  { line: '蒹葭苍苍，白露为霜', author: '佚名', title: '蒹葭', stage: '初中' },
  { line: '所谓伊人，在水一方', author: '佚名', title: '蒹葭', stage: '初中' },
  { line: '青青子衿，悠悠我心', author: '佚名', title: '子衿', stage: '初中' },
  { line: '一日不见，如三月兮', author: '佚名', title: '子衿', stage: '初中' },
  { line: '式微式微，胡不归', author: '佚名', title: '式微', stage: '初中' },
  { line: '微君之故，胡为乎中露', author: '佚名', title: '式微', stage: '初中' },
  { line: '东临碣石，以观沧海', author: '曹操', title: '观沧海', stage: '初中' },
  { line: '水何澹澹，山岛竦峙', author: '曹操', title: '观沧海', stage: '初中' },
  { line: '日月之行，若出其中', author: '曹操', title: '观沧海', stage: '初中' },
  { line: '幸甚至哉，歌以咏志', author: '曹操', title: '观沧海', stage: '初中' },
  { line: '杨花落尽子规啼', author: '李白', title: '闻王昌龄左迁龙标遥有此寄', stage: '初中' },
  { line: '我寄愁心与明月', author: '李白', title: '闻王昌龄左迁龙标遥有此寄', stage: '初中' },
  { line: '客路青山外', author: '王湾', title: '次北固山下', stage: '初中' },
  { line: '潮平两岸阔', author: '王湾', title: '次北固山下', stage: '初中' },
  { line: '海日生残夜', author: '王湾', title: '次北固山下', stage: '初中' },
  { line: '乡书何处达', author: '王湾', title: '次北固山下', stage: '初中' },
  { line: '孤山寺北贾亭西', author: '白居易', title: '钱塘湖春行', stage: '初中' },
  { line: '几处早莺争暖树', author: '白居易', title: '钱塘湖春行', stage: '初中' },
  { line: '乱花渐欲迷人眼', author: '白居易', title: '钱塘湖春行', stage: '初中' },
  { line: '最爱湖东行不足', author: '白居易', title: '钱塘湖春行', stage: '初中' },
  { line: '枯藤老树昏鸦', author: '马致远', title: '天净沙·秋思', stage: '初中' },
  { line: '小桥流水人家', author: '马致远', title: '天净沙·秋思', stage: '初中' },
  { line: '古道西风瘦马', author: '马致远', title: '天净沙·秋思', stage: '初中' },
  { line: '断肠人在天涯', author: '马致远', title: '天净沙·秋思', stage: '初中' },
  { line: '峨眉山月半轮秋', author: '李白', title: '峨眉山月歌', stage: '初中' },
  { line: '影入平羌江水流', author: '李白', title: '峨眉山月歌', stage: '初中' },
  { line: '岐王宅里寻常见', author: '杜甫', title: '江南逢李龟年', stage: '初中' },
  { line: '落花时节又逢君', author: '杜甫', title: '江南逢李龟年', stage: '初中' },
  { line: '强欲登高去', author: '岑参', title: '行军九日思长安故园', stage: '初中' },
  { line: '应傍战场开', author: '岑参', title: '行军九日思长安故园', stage: '初中' },
  { line: '自古逢秋悲寂寥', author: '刘禹锡', title: '秋词', stage: '初中' },
  { line: '我言秋日胜春朝', author: '刘禹锡', title: '秋词', stage: '初中' },
  { line: '晴空一鹤排云上', author: '刘禹锡', title: '秋词', stage: '初中' },
  { line: '便引诗情到碧霄', author: '刘禹锡', title: '秋词', stage: '初中' },
  { line: '君问归期未有期', author: '李商隐', title: '夜雨寄北', stage: '初中' },
  { line: '巴山夜雨涨秋池', author: '李商隐', title: '夜雨寄北', stage: '初中' },
  { line: '何当共剪西窗烛', author: '李商隐', title: '夜雨寄北', stage: '初中' },
  { line: '却话巴山夜雨时', author: '李商隐', title: '夜雨寄北', stage: '初中' },
  { line: '终古高云簇此城', author: '谭嗣同', title: '潼关', stage: '初中' },
  { line: '山入潼关不解平', author: '谭嗣同', title: '潼关', stage: '初中' },
  { line: '独坐幽篁里', author: '王维', title: '竹里馆', stage: '初中' },
  { line: '弹琴复长啸', author: '王维', title: '竹里馆', stage: '初中' },
  { line: '深林人不知', author: '王维', title: '竹里馆', stage: '初中' },
  { line: '明月来相照', author: '王维', title: '竹里馆', stage: '初中' },
  { line: '谁家玉笛暗飞声', author: '李白', title: '春夜洛城闻笛', stage: '初中' },
  { line: '何人不起故园情', author: '李白', title: '春夜洛城闻笛', stage: '初中' },
  { line: '故园东望路漫漫', author: '岑参', title: '逢入京使', stage: '初中' },
  { line: '双袖龙钟泪不干', author: '岑参', title: '逢入京使', stage: '初中' },
  { line: '马上相逢无纸笔', author: '岑参', title: '逢入京使', stage: '初中' },
  { line: '凭君传语报平安', author: '岑参', title: '逢入京使', stage: '初中' },
  { line: '草树知春不久归', author: '韩愈', title: '晚春', stage: '初中' },
  { line: '百般红紫斗芳菲', author: '韩愈', title: '晚春', stage: '初中' },
  { line: '念天地之悠悠', author: '陈子昂', title: '登幽州台歌', stage: '初中' },
  { line: '独怆然而涕下', author: '陈子昂', title: '登幽州台歌', stage: '初中' },
  { line: '岱宗夫如何', author: '杜甫', title: '望岳', stage: '初中' },
  { line: '造化钟神秀', author: '杜甫', title: '望岳', stage: '初中' },
  { line: '会当凌绝顶', author: '杜甫', title: '望岳', stage: '初中' },
  { line: '一览众山小', author: '杜甫', title: '望岳', stage: '初中' },
  { line: '莫笑农家腊酒浑', author: '陆游', title: '游山西村', stage: '初中' },
  { line: '山重水复疑无路', author: '陆游', title: '游山西村', stage: '初中' },
  { line: '柳暗花明又一村', author: '陆游', title: '游山西村', stage: '初中' },
  { line: '衣冠简朴古风存', author: '陆游', title: '游山西村', stage: '初中' },
  { line: '飞来山上千寻塔', author: '王安石', title: '登飞来峰', stage: '初中' },
  { line: '不畏浮云遮望眼', author: '王安石', title: '登飞来峰', stage: '初中' },
  { line: '烟笼寒水月笼沙', author: '杜牧', title: '泊秦淮', stage: '初中' },
  { line: '夜泊秦淮近酒家', author: '杜牧', title: '泊秦淮', stage: '初中' },
  { line: '商女不知亡国恨', author: '杜牧', title: '泊秦淮', stage: '初中' },
  { line: '隔江犹唱后庭花', author: '杜牧', title: '泊秦淮', stage: '初中' },
  { line: '浩荡离愁白日斜', author: '龚自珍', title: '己亥杂诗', stage: '初中' },
  { line: '吟鞭东指即天涯', author: '龚自珍', title: '己亥杂诗', stage: '初中' },
  { line: '落红不是无情物', author: '龚自珍', title: '己亥杂诗', stage: '初中' },
  { line: '化作春泥更护花', author: '龚自珍', title: '己亥杂诗', stage: '初中' },
  { line: '神龟虽寿，犹有竟时', author: '曹操', title: '龟虽寿', stage: '初中' },
  { line: '老骥伏枥，志在千里', author: '曹操', title: '龟虽寿', stage: '初中' },
  { line: '烈士暮年，壮心不已', author: '曹操', title: '龟虽寿', stage: '初中' },
  { line: '风声一何盛', author: '刘桢', title: '赠从弟', stage: '初中' },
  { line: '松柏有本性', author: '刘桢', title: '赠从弟', stage: '初中' },
  { line: '树树皆秋色', author: '王绩', title: '野望', stage: '初中' },
  { line: '山山唯落晖', author: '王绩', title: '野望', stage: '初中' },
  { line: '晴川历历汉阳树', author: '崔颢', title: '黄鹤楼', stage: '初中' },
  { line: '芳草萋萋鹦鹉洲', author: '崔颢', title: '黄鹤楼', stage: '初中' },
  { line: '日暮乡关何处是', author: '崔颢', title: '黄鹤楼', stage: '初中' },
  { line: '烟波江上使人愁', author: '崔颢', title: '黄鹤楼', stage: '初中' },
  { line: '单车欲问边', author: '王维', title: '使至塞上', stage: '初中' },
  { line: '征蓬出汉塞', author: '王维', title: '使至塞上', stage: '初中' },
  { line: '大漠孤烟直', author: '王维', title: '使至塞上', stage: '初中' },
  { line: '长河落日圆', author: '王维', title: '使至塞上', stage: '初中' },
  { line: '渡远荆门外', author: '李白', title: '渡荆门送别', stage: '初中' },
  { line: '山随平野尽', author: '李白', title: '渡荆门送别', stage: '初中' },
  { line: '江入大荒流', author: '李白', title: '渡荆门送别', stage: '初中' },
  { line: '云生结海楼', author: '李白', title: '渡荆门送别', stage: '初中' },
  { line: '白日依山尽', author: '王之涣', title: '登鹳雀楼', stage: '初中' },
  { line: '黄河入海流', author: '王之涣', title: '登鹳雀楼', stage: '初中' },
  { line: '欲穷千里目', author: '王之涣', title: '登鹳雀楼', stage: '初中' },
  { line: '更上一层楼', author: '王之涣', title: '登鹳雀楼', stage: '初中' },
  { line: '床前明月光', author: '李白', title: '静夜思', stage: '初中' },
  { line: '举头望明月', author: '李白', title: '静夜思', stage: '初中' },
  { line: '低头思故乡', author: '李白', title: '静夜思', stage: '初中' },
  { line: '春眠不觉晓', author: '孟浩然', title: '春晓', stage: '初中' },
  { line: '夜来风雨声', author: '孟浩然', title: '春晓', stage: '初中' },
  { line: '花落知多少', author: '孟浩然', title: '春晓', stage: '初中' },
  { line: '迟日江山丽', author: '杜甫', title: '绝句', stage: '初中' },
  { line: '春风花草香', author: '杜甫', title: '绝句', stage: '初中' },
  { line: '泥融飞燕子', author: '杜甫', title: '绝句', stage: '初中' },
  { line: '沙暖睡鸳鸯', author: '杜甫', title: '绝句', stage: '初中' },
  { line: '北国风光，千里冰封', author: '毛泽东', title: '沁园春·雪', stage: '高中' },
  { line: '望长城内外，惟余莽莽', author: '毛泽东', title: '沁园春·雪', stage: '高中' },
  { line: '山舞银蛇，原驰蜡象', author: '毛泽东', title: '沁园春·雪', stage: '高中' },
  { line: '俱往矣，数风流人物', author: '毛泽东', title: '沁园春·雪', stage: '高中' },
  { line: '氓之蚩蚩，抱布贸丝', author: '佚名', title: '氓', stage: '高中' },
  { line: '桑之未落，其叶沃若', author: '佚名', title: '氓', stage: '高中' },
  { line: '淇水汤汤，渐车帷裳', author: '佚名', title: '氓', stage: '高中' },
  { line: '信誓旦旦，不思其反', author: '佚名', title: '氓', stage: '高中' },
  { line: '静女其姝，俟我于城隅', author: '佚名', title: '静女', stage: '高中' },
  { line: '爱而不见，搔首踟蹰', author: '佚名', title: '静女', stage: '高中' },
  { line: '涉江采芙蓉，兰泽多芳草', author: '佚名', title: '涉江采芙蓉', stage: '高中' },
  { line: '同心而离居，忧伤以终老', author: '佚名', title: '涉江采芙蓉', stage: '高中' },
  { line: '对酒当歌，人生几何', author: '曹操', title: '短歌行', stage: '高中' },
  { line: '譬如朝露，去日苦多', author: '曹操', title: '短歌行', stage: '高中' },
  { line: '青青子衿，悠悠我心', author: '曹操', title: '短歌行', stage: '高中' },
  { line: '山不厌高，海不厌深', author: '曹操', title: '短歌行', stage: '高中' },
  { line: '少无适俗韵，性本爱丘山', author: '陶渊明', title: '归园田居', stage: '高中' },
  { line: '羁鸟恋旧林，池鱼思故渊', author: '陶渊明', title: '归园田居', stage: '高中' },
  { line: '狗吠深巷中，鸡鸣桑树颠', author: '陶渊明', title: '归园田居', stage: '高中' },
  { line: '久在樊笼里，复得返自然', author: '陶渊明', title: '归园田居', stage: '高中' },
  { line: '海客谈瀛洲，烟涛微茫信难求', author: '李白', title: '梦游天姥吟留别', stage: '高中' },
  { line: '天姥连天向天横', author: '李白', title: '梦游天姥吟留别', stage: '高中' },
  { line: '半壁见海日，空中闻天鸡', author: '李白', title: '梦游天姥吟留别', stage: '高中' },
  { line: '安能摧眉折腰事权贵', author: '李白', title: '梦游天姥吟留别', stage: '高中' },
  { line: '风急天高猿啸哀', author: '杜甫', title: '登高', stage: '高中' },
  { line: '渚清沙白鸟飞回', author: '杜甫', title: '登高', stage: '高中' },
  { line: '无边落木萧萧下', author: '杜甫', title: '登高', stage: '高中' },
  { line: '不尽长江滚滚来', author: '杜甫', title: '登高', stage: '高中' },
  { line: '丞相祠堂何处寻', author: '杜甫', title: '蜀相', stage: '高中' },
  { line: '映阶碧草自春色', author: '杜甫', title: '蜀相', stage: '高中' },
  { line: '三顾频烦天下计', author: '杜甫', title: '蜀相', stage: '高中' },
  { line: '长使英雄泪满襟', author: '杜甫', title: '蜀相', stage: '高中' },
  { line: '浔阳江头夜送客', author: '白居易', title: '琵琶行', stage: '高中' },
  { line: '千呼万唤始出来', author: '白居易', title: '琵琶行', stage: '高中' },
  { line: '大弦嘈嘈如急雨', author: '白居易', title: '琵琶行', stage: '高中' },
  { line: '同是天涯沦落人', author: '白居易', title: '琵琶行', stage: '高中' },
  { line: '锦瑟无端五十弦', author: '李商隐', title: '锦瑟', stage: '高中' },
  { line: '庄生晓梦迷蝴蝶', author: '李商隐', title: '锦瑟', stage: '高中' },
  { line: '沧海月明珠有泪', author: '李商隐', title: '锦瑟', stage: '高中' },
  { line: '此情可待成追忆', author: '李商隐', title: '锦瑟', stage: '高中' },
  { line: '李凭中国弹箜篌', author: '李贺', title: '李凭箜篌引', stage: '高中' },
  { line: '昆山玉碎凤凰叫', author: '李贺', title: '李凭箜篌引', stage: '高中' },
  { line: '女娲炼石补天处', author: '李贺', title: '李凭箜篌引', stage: '高中' },
  { line: '石破天惊逗秋雨', author: '李贺', title: '李凭箜篌引', stage: '高中' },
  { line: '泻水置平地，各自东西南北流', author: '鲍照', title: '拟行路难', stage: '高中' },
  { line: '人生亦有命，安能行叹复坐愁', author: '鲍照', title: '拟行路难', stage: '高中' },
  { line: '出师一表真名世', author: '陆游', title: '书愤', stage: '高中' },
  { line: '千载谁堪伯仲间', author: '陆游', title: '书愤', stage: '高中' },
  { line: '世味年来薄似纱', author: '陆游', title: '临安春雨初霁', stage: '高中' },
  { line: '小楼一夜听春雨', author: '陆游', title: '临安春雨初霁', stage: '高中' },
  { line: '矮纸斜行闲作草', author: '陆游', title: '临安春雨初霁', stage: '高中' },
  { line: '晴窗细乳戏分茶', author: '陆游', title: '临安春雨初霁', stage: '高中' },
  { line: '舍南舍北皆春水', author: '杜甫', title: '客至', stage: '高中' },
  { line: '但见群鸥日日来', author: '杜甫', title: '客至', stage: '高中' },
  { line: '盘飧市远无兼味', author: '杜甫', title: '客至', stage: '高中' },
  { line: '樽酒家贫只旧醅', author: '杜甫', title: '客至', stage: '高中' },
  { line: '痴儿了却公家事', author: '黄庭坚', title: '登快阁', stage: '高中' },
  { line: '快阁东西倚晚晴', author: '黄庭坚', title: '登快阁', stage: '高中' },
  { line: '落木千山天远大', author: '黄庭坚', title: '登快阁', stage: '高中' },
  { line: '澄江一道月分明', author: '黄庭坚', title: '登快阁', stage: '高中' },
  { line: '寻寻觅觅，冷冷清清', author: '李清照', title: '声声慢', stage: '高中' },
  { line: '三杯两盏淡酒', author: '李清照', title: '声声慢', stage: '高中' },
  { line: '满地黄花堆积', author: '李清照', title: '声声慢', stage: '高中' },
  { line: '怎一个愁字了得', author: '李清照', title: '声声慢', stage: '高中' },
  { line: '大江东去，浪淘尽', author: '苏轼', title: '念奴娇·赤壁怀古', stage: '高中' },
  { line: '乱石穿空，惊涛拍岸', author: '苏轼', title: '念奴娇·赤壁怀古', stage: '高中' },
  { line: '羽扇纶巾，谈笑间', author: '苏轼', title: '念奴娇·赤壁怀古', stage: '高中' },
  { line: '一尊还酹江月', author: '苏轼', title: '念奴娇·赤壁怀古', stage: '高中' },
  { line: '千古江山，英雄无觅', author: '辛弃疾', title: '永遇乐·京口北固亭怀古', stage: '高中' },
  { line: '舞榭歌台，风流总被', author: '辛弃疾', title: '永遇乐·京口北固亭怀古', stage: '高中' },
  { line: '金戈铁马，气吞万里如虎', author: '辛弃疾', title: '永遇乐·京口北固亭怀古', stage: '高中' },
  { line: '凭谁问，廉颇老矣', author: '辛弃疾', title: '永遇乐·京口北固亭怀古', stage: '高中' },
  { line: '寒蝉凄切，对长亭晚', author: '柳永', title: '雨霖铃', stage: '高中' },
  { line: '燕燕于飞，差池其羽', author: '佚名', title: '燕燕', stage: '拓展' },
  { line: '昔我往矣，杨柳依依', author: '佚名', title: '采薇', stage: '拓展' },
  { line: '今我来思，雨雪霏霏', author: '佚名', title: '采薇', stage: '拓展' },
  { line: '路漫漫其修远兮', author: '屈原', title: '离骚', stage: '拓展' },
  { line: '吾将上下而求索', author: '屈原', title: '离骚', stage: '拓展' },
  { line: '长太息以掩涕兮', author: '屈原', title: '离骚', stage: '拓展' },
  { line: '举世皆浊我独清', author: '屈原', title: '渔父', stage: '拓展' },
  { line: '众人皆醉我独醒', author: '屈原', title: '渔父', stage: '拓展' },
  { line: '迢迢牵牛星', author: '佚名', title: '迢迢牵牛星', stage: '拓展' },
  { line: '皎皎河汉女', author: '佚名', title: '迢迢牵牛星', stage: '拓展' },
  { line: '盈盈一水间', author: '佚名', title: '迢迢牵牛星', stage: '拓展' },
  { line: '脉脉不得语', author: '佚名', title: '迢迢牵牛星', stage: '拓展' },
  { line: '孔雀东南飞', author: '佚名', title: '孔雀东南飞', stage: '拓展' },
  { line: '五里一徘徊', author: '佚名', title: '孔雀东南飞', stage: '拓展' },
  { line: '鸡鸣入机织', author: '佚名', title: '孔雀东南飞', stage: '拓展' },
  { line: '夜夜不得息', author: '佚名', title: '孔雀东南飞', stage: '拓展' },
  { line: '采菊东篱下', author: '陶渊明', title: '饮酒', stage: '拓展' },
  { line: '悠然见南山', author: '陶渊明', title: '饮酒', stage: '拓展' },
  { line: '山气日夕佳', author: '陶渊明', title: '饮酒', stage: '拓展' },
  { line: '飞鸟相与还', author: '陶渊明', title: '饮酒', stage: '拓展' },
]

const TOKEN_HINTS: Array<[string, string]> = [
  ['月', '明月'], ['春', '春意'], ['风', '清风'], ['花', '花影'], ['雪', '雪色'],
  ['雨', '雨声'], ['江', '江水'], ['河', '长河'], ['海', '沧海'], ['山', '青山'],
  ['云', '云影'], ['舟', '孤舟'], ['酒', '酒盏'], ['剑', '剑光'], ['马', '征马'],
  ['雁', '归雁'], ['鸟', '飞鸟'], ['柳', '杨柳'], ['莲', '莲叶'], ['荷', '荷花'],
  ['日', '落日'], ['夜', '长夜'], ['秋', '秋色'], ['乡', '乡思'], ['人', '行人'],
  ['城', '城阙'], ['楼', '高楼'], ['关', '边关'], ['沙', '黄沙'], ['草', '芳草'],
  ['松', '松影'], ['竹', '竹林'], ['梦', '梦境'], ['泪', '泪痕'], ['烛', '烛影'],
  ['钟', '钟声'], ['烟', '烟霞'], ['水', '水光'], ['灯', '灯火'], ['桥', '古桥'],
  ['笛', '玉笛'], ['袖', '衣袖'], ['琴', '琴声'], ['歌', '歌声'], ['鹤', '白鹤'],
  ['桂', '桂花'], ['兰', '兰泽'], ['桑', '桑叶'], ['淇', '淇水'], ['衿', '青衿'],
  ['君', '友人'], ['归', '归途'], ['故', '故园'], ['鸥', '群鸥'], ['鸡', '鸡鸣'],
  ['平安', '家书'], ['芙蓉', '芙蓉'],
]

const FALLBACK_HINTS = ['古卷', '墨色', '远景', '诗意', '留白']

function makeVisualWords(seed: PoetrySeed) {
  const text = `${seed.line}${seed.title}`
  const words = TOKEN_HINTS
    .filter(([token]) => text.includes(token))
    .map(([, word]) => word)
    .filter((word, index, arr) => arr.indexOf(word) === index)

  return [...words, ...FALLBACK_HINTS].slice(0, 5)
}

function makeMood(seed: PoetrySeed) {
  const text = `${seed.line}${seed.title}`
  if (/[塞关戈马沙]/.test(text)) return '苍凉开阔'
  if (/[月夜乡愁泪]/.test(text)) return '清冷思归'
  if (/[春花柳莺草]/.test(text)) return '明丽流动'
  if (/[江河海涛浪]/.test(text)) return '浩荡辽远'
  if (/[酒灯烛梦]/.test(text)) return '幽微含蓄'
  return seed.stage === '高中' ? '典雅深沉' : seed.stage === '拓展' ? '古奥耐读' : '清晰明快'
}

function makePalette(seed: PoetrySeed): [string, string, string] {
  const text = `${seed.line}${seed.title}`
  if (/[雪霜冰]/.test(text)) return ['#e0f2fe', '#64748b', '#020617']
  if (/[春花柳莺草]/.test(text)) return ['#dcfce7', '#22c55e', '#052e16']
  if (/[塞关戈马沙]/.test(text)) return ['#fde68a', '#c2410c', '#1c1917']
  if (/[江河海涛浪水]/.test(text)) return ['#cffafe', '#0891b2', '#082f49']
  if (/[月夜灯烛]/.test(text)) return ['#e0e7ff', '#4f46e5', '#020617']
  if (/[酒黄花秋]/.test(text)) return ['#fef3c7', '#d97706', '#111827']
  return ['#f8fafc', '#00f0ff', '#050816']
}

function makeImagePrompt(seed: PoetrySeed) {
  const words = makeVisualWords(seed).slice(0, 4).join('、')
  return `AI 生成：一幅${seed.stage}诗词画面，突出${words}等意象，整体氛围${makeMood(seed)}，请根据画面反推完整答案。`
}

const SCENES: PoetryScene[] = POEM_SEEDS.map((seed, index) => ({
  ...seed,
  id: `poem-${String(index + 1).padStart(3, '0')}`,
  imagePrompt: makeImagePrompt(seed),
  visualWords: makeVisualWords(seed),
  palette: makePalette(seed),
}))

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function buildRounds(level: Level): Round[] {
  const cfg = CONFIG[level]
  const levelPool = SCENES.filter(scene => cfg.stages.includes(scene.stage))
  return shuffle(levelPool).slice(0, cfg.rounds).map(scene => {
    const decoyPool = levelPool.length >= cfg.options
      ? levelPool
      : SCENES
    const decoys = shuffle(decoyPool.filter(item => item.id !== scene.id))
      .slice(0, cfg.options - 1)
    return {
      scene,
      options: shuffle([scene, ...decoys]),
    }
  })
}

function answerText(scene: PoetryScene) {
  return `${scene.line}｜${scene.author}《${scene.title}》`
}

export default function AIPoetryGuess({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [status, setStatus] = useState<Status>('idle')
  const [rounds, setRounds] = useState<Round[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [selected, setSelected] = useState('')
  const [feedback, setFeedback] = useState('AI 将根据诗句生成画面，你来反推原句。')

  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)

  const currentRound = rounds[roundIndex]
  const cfg = CONFIG[level]

  const visibleWords = useMemo(() => {
    if (!currentRound) return []
    return currentRound.scene.visualWords.slice(0, Math.min(currentRound.scene.visualWords.length, cfg.baseClues + hintsUsed))
  }, [currentRound, cfg.baseClues, hintsUsed])

  const submitRecord = useCallback(
    async (finalScore: number, finalCorrect: number, total: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const duration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      const accuracy = total > 0 ? finalCorrect / total : 0
      const result = accuracy >= 0.6 ? 'win' : accuracy > 0 ? 'complete' : 'lose'
      try {
        await createRecord(userId, { gameId, score: finalScore, duration, result })
      } catch {}
    },
    [userId, gameId]
  )

  const startGame = () => {
    setRounds(buildRounds(level))
    setStatus('playing')
    setRoundIndex(0)
    setScore(0)
    setCorrectCount(0)
    setStreak(0)
    setHintsUsed(0)
    setSelected('')
    setFeedback('AI 已生成第一幅诗画。')
    submittedRef.current = false
    startTimeRef.current = Date.now()
  }

  const resetGame = () => {
    setStatus('idle')
    setRounds([])
    setRoundIndex(0)
    setScore(0)
    setCorrectCount(0)
    setStreak(0)
    setHintsUsed(0)
    setSelected('')
    setFeedback('AI 将根据诗句生成画面，你来反推原句。')
    submittedRef.current = false
  }

  const finishGame = useCallback(
    (finalScore: number, finalCorrect: number) => {
      setStatus('over')
      setFeedback(`结算完成：猜中 ${finalCorrect}/${rounds.length}，总分 ${finalScore}。`)
      void submitRecord(finalScore, finalCorrect, rounds.length)
    },
    [rounds.length, submitRecord]
  )

  const chooseAnswer = (option: PoetryScene) => {
    if (status !== 'playing' || selected || !currentRound) return

    const isCorrect = option.id === currentRound.scene.id
    setSelected(option.id)
    if (isCorrect) {
      const earned = Math.max(25, 100 + streak * 18 + (level === '复杂' ? 30 : level === '中等' ? 15 : 0) - hintsUsed * cfg.hintCost)
      setScore(value => value + earned)
      setCorrectCount(value => value + 1)
      setStreak(value => value + 1)
      setFeedback(`命中！+${earned}PT，答案是 ${answerText(currentRound.scene)}。`)
    } else {
      setStreak(0)
      setFeedback(`未命中。正确答案是 ${answerText(currentRound.scene)}。`)
    }
  }

  const nextRound = () => {
    if (!selected) return
    if (roundIndex + 1 >= rounds.length) {
      finishGame(score, correctCount)
      return
    }
    setRoundIndex(value => value + 1)
    setHintsUsed(0)
    setSelected('')
    setFeedback('AI 已生成下一幅诗画。')
  }

  const addHint = () => {
    if (!currentRound || selected || status !== 'playing') return
    const maxHints = Math.max(0, currentRound.scene.visualWords.length - cfg.baseClues)
    if (hintsUsed >= maxHints) {
      setFeedback('这幅诗画的线索已经全部公开。')
      return
    }
    setHintsUsed(value => value + 1)
    setScore(value => Math.max(0, value - cfg.hintCost))
    setFeedback(`AI 追加了一条视觉线索，-${cfg.hintCost}PT。`)
  }

  const picking = status === 'idle' || status === 'over'
  const progress = status === 'playing' ? `${roundIndex + 1}/${rounds.length}` : `0/${cfg.rounds}`
  const scene = currentRound?.scene

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['SCORE', `${score} PT`, 'text-crt-cyan'],
          ['ROUND', progress, 'text-crt-yellow'],
          ['HIT', `${correctCount}`, 'text-crt-green'],
          ['COMBO', `×${streak}`, 'text-crt-pink'],
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-black/45 border-2 border-crt-border p-3">
            <p className="font-pixel text-[8px] text-crt-text-dim tracking-widest mb-2">{label}</p>
            <p className={`font-mono-crt text-2xl tracking-wider ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(CONFIG) as Level[]).map(item => (
          <button
            key={item}
            type="button"
            disabled={!picking}
            onClick={() => {
              setLevel(item)
              resetGame()
            }}
            className={`px-3 py-2 border-2 font-pixel text-[8px] tracking-widest transition-all ${
              level === item
                ? 'bg-crt-cyan text-crt-bg-deep border-crt-cyan shadow-neon-c'
                : 'bg-black/30 text-crt-text-dim border-crt-border hover:border-crt-cyan hover:text-crt-cyan'
            } ${!picking ? 'opacity-45 cursor-not-allowed' : ''}`}
          >
            {item} · {CONFIG[item].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
        <div
          className="relative min-h-[360px] border-2 border-crt-cyan overflow-hidden bg-black"
          style={{
            background: scene
              ? `radial-gradient(circle at 18% 18%, ${scene.palette[0]}cc 0, transparent 26%), radial-gradient(circle at 82% 22%, ${scene.palette[1]}99 0, transparent 28%), linear-gradient(135deg, ${scene.palette[2]} 0%, #050816 55%, ${scene.palette[1]} 130%)`
              : 'linear-gradient(135deg, #050816, #151a3a)',
          }}
        >
          <div className="absolute inset-0 crt-scanlines opacity-50" />
          <div className="relative z-10 min-h-[360px] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-3">
              <p className="font-pixel text-[9px] text-crt-cyan tracking-widest" style={{ textShadow: '0 0 8px #00F0FF' }}>
                AI IMAGE FEED
              </p>
              <span className="font-mono-crt text-sm text-crt-yellow bg-black/70 border border-crt-yellow/60 px-2 py-1 tracking-wider">
                {status === 'playing' ? `FRAME ${roundIndex + 1}` : 'STANDBY'}
              </span>
            </div>

            {scene ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {visibleWords.map(word => (
                    <div
                      key={word}
                      className="min-h-[58px] flex items-center justify-center bg-black/55 border-2 border-crt-yellow/70 text-crt-yellow font-mono-crt text-2xl tracking-widest"
                      style={{ textShadow: '0 0 8px #FFE500' }}
                    >
                      {word}
                    </div>
                  ))}
                </div>
                <div className="bg-black/60 border-2 border-crt-border p-4">
                  <p className="font-mono-crt text-xl md:text-2xl text-crt-text leading-relaxed tracking-wide">
                    {scene.imagePrompt}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-pixel text-[12px] text-crt-yellow tracking-widest mb-4 animate-blink">
                  POETRY VISION AI
                </p>
                <p className="font-mono-crt text-xl text-crt-text-dim tracking-wide">
                  &gt; START TO GENERATE IMAGE CLUES
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {status === 'idle' && (
                <button
                  type="button"
                  onClick={startGame}
                  className="px-7 py-3 bg-crt-yellow text-crt-bg-deep border-2 border-crt-yellow font-pixel text-[10px] tracking-widest shadow-neon-y hover:shadow-[0_0_18px_#FFE500] transition-all"
                >
                  START GUESS
                </button>
              )}
              {status === 'over' && (
                <button
                  type="button"
                  onClick={startGame}
                  className="px-7 py-3 bg-crt-pink text-white border-2 border-crt-pink font-pixel text-[10px] tracking-widest shadow-neon-p hover:shadow-[0_0_18px_#FF2EC8] transition-all"
                >
                  PLAY AGAIN
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-black/35 border-2 border-crt-pink p-4 space-y-4">
          <div>
            <p className="font-pixel text-[9px] text-crt-pink tracking-widest mb-2" style={{ textShadow: '0 0 6px #FF2EC8' }}>
              AI PROMPT
            </p>
            <p className="font-mono-crt text-lg text-crt-text leading-snug min-h-[72px] tracking-wide">{feedback}</p>
          </div>

          <button
            type="button"
            onClick={addHint}
            disabled={status !== 'playing' || !!selected || !scene}
            className="w-full py-2.5 bg-transparent text-crt-yellow border-2 border-crt-yellow font-pixel text-[9px] tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-crt-yellow hover:text-crt-bg-deep transition-all"
          >
            AI HINT -{cfg.hintCost}PT
          </button>

          {selected && status === 'playing' && (
            <button
              type="button"
              onClick={nextRound}
              className="w-full py-2.5 bg-crt-cyan text-crt-bg-deep border-2 border-crt-cyan font-pixel text-[9px] tracking-widest shadow-neon-c hover:shadow-[0_0_18px_#00F0FF] transition-all"
            >
              {roundIndex + 1 >= rounds.length ? 'SHOW RESULT' : 'NEXT IMAGE'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(currentRound?.options ?? []).map(option => {
          const isPicked = selected === option.id
          const isAnswer = option.id === currentRound?.scene.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={status !== 'playing' || !!selected}
              onClick={() => chooseAnswer(option)}
              className={`min-h-[86px] border-2 p-4 text-left transition-all ${
                selected
                  ? isAnswer
                    ? 'bg-crt-green/15 border-crt-green'
                    : isPicked
                      ? 'bg-crt-pink/15 border-crt-pink'
                      : 'bg-black/25 border-crt-border opacity-60'
                  : 'bg-black/35 border-crt-border hover:border-crt-cyan hover:bg-crt-cyan/10'
              }`}
            >
              <p className="font-mono-crt text-xl md:text-2xl text-crt-text leading-tight tracking-wide">{answerText(option)}</p>
              <p className="font-mono-crt text-sm text-crt-text-dim mt-2 tracking-wide">难度：{option.stage}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
