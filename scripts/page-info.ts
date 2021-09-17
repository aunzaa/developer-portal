// Global
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
// Interfaces
import type {
  MarkdownMeta,
  PageInfo,
  ChildPageInfo,
  PartialData,
  PagePartialContentDict,
} from '@/interfaces/page-info';
// Components
import StackExchangeApi from '@/components/integrations/stackexchange/StackExchange.api';
import YouTubeApi from '@/components/integrations/youtube/YouTube.api';

const dataDirectory = path.join(process.cwd(), 'data/markdown');
const partialsDirectory = path.join(dataDirectory, 'partials');
const pagesDirectory = path.join(dataDirectory, 'pages');

type Matter = {
  data: {
    title?: string;
    [name: string]: unknown;
  };
  content: string;
};

type ProductSolutionContextParams = {
  solution: string;
  product?: string;
};

const getSolutionFile = ({ solution }: ProductSolutionContextParams): string =>
  `solution/${solution}`;

const getProductFile = ({ solution, product }: ProductSolutionContextParams): string =>
  `solution/${solution}/product/${product}`;

const getFileFromContext = (params: ProductSolutionContextParams) => {
  return params.hasOwnProperty('product') ? getProductFile(params) : getSolutionFile(params);
};

const getFileData = (directory: string, file: string): Matter => {
  const filePath = path.join(directory, `${file}.md`);
  const fileMarkdown = fs.readFileSync(filePath, 'utf-8');
  // @TODO: Handle failures
  return matter(fileMarkdown);
};

export const getPageInfo = async (
  arg: string | ProductSolutionContextParams
): Promise<PageInfo | null> => {
  const file = typeof arg === 'string' ? arg : getFileFromContext(arg);
  const meta = getFileData(pagesDirectory, `${file}/index`).data as MarkdownMeta;

  const pageInfo = {
    // Default hasInPageNav to true, overwrite with false in md
    hasInPageNav: true,
    ...meta,
    stackexchange: [],
    youtube: [],
    twitter: [],
  } as PageInfo;

  /**
   * Fetch all integrations for the page so we can limit the number of requests
   *
   * All of these APIs will return an empty array if the corresponding meta key is null
   */
  pageInfo.stackexchange = await StackExchangeApi.get(meta.stackexchange);
  pageInfo.youtube = await YouTubeApi.get(meta.youtube);

  return pageInfo;
};

/**
 * Gets a list of markdown partials
 *
 * @param args An object ccontaining keyed references to partial markdown files
 * @returns An object of the same key structure with the corresponding markdown data
 */
export const getPartials = async (
  args: Record<string, string>
): Promise<PagePartialContentDict> => {
  const partials: PagePartialContentDict = {};
  Object.entries(args).forEach(([key, val]) => {
    partials[key] = getFileData(partialsDirectory, val).content;
  });
  return partials;
};

/**
 * Get partials as an array rather than a keyed object
 *
 * @param partials
 * @returns
 */
const getTiltesFromContent = (content: string): string[] => {
  const regExp = /(?<=^\#\#\s)(.*?)(?=\n)/gm;
  const res = content.match(regExp);
  if (res) {
    return res.map((title) => {
      if (title.startsWith('[')) {
        const anchorTextRegExp = /(?<=\[)(.*?)(?=\])/g;
        const anchorText = content.match(anchorTextRegExp);
        return !!anchorText ? anchorText[0] : '';
      }
      return title;
    });
  }
  return [];
};

export const getPartialsAsArray = async (partials: string[]): Promise<PartialData> => {
  const content: string[] = [];
  let titles: string[] = [];

  partials.forEach((p) => {
    const data = getFileData(partialsDirectory, p) as Matter;
    content.push(data.content);
    titles = titles.concat(getTiltesFromContent(data.content));
  });

  return {
    content,
    titles,
  };
};

/**
 * Gets a list of ChildPageInfo for use on a parent page
 *
 * @param params The context params for the dynamic page
 * @returns An array of simplified ChildPageInfo for display on a parent page
 */
export const getChildPageInfo = async (
  params: ProductSolutionContextParams
): Promise<ChildPageInfo[]> => {
  const directory = path.join(pagesDirectory, `${getSolutionFile(params)}/product`);
  const children = fs.readdirSync(directory);
  return children.map((child) => {
    const meta = getFileData(directory, `${child}/index`).data as MarkdownMeta;

    return {
      description: meta.description,
      id: child,
      link: `/${Object.values(params)[0]}/${child}`,
      title: meta.title,
    } as ChildPageInfo;
  });
};